const fs = require('fs');
const path = require('path');

console.log('[patch-ios] Running iOS build configuration patches...');

// 1. Patch react-native-safe-area-context.podspec
const podspecPath = path.resolve(__dirname, '../node_modules/react-native-safe-area-context/react-native-safe-area-context.podspec');
if (fs.existsSync(podspecPath)) {
  let podspec = fs.readFileSync(podspecPath, 'utf8');
  if (podspec.includes('"HEADER_SEARCH_PATHS" => "\\"$(PODS_TARGET_SRCROOT)/common/cpp\\""')) {
    podspec = podspec.replaceAll(
      '"HEADER_SEARCH_PATHS" => "\\"$(PODS_TARGET_SRCROOT)/common/cpp\\""',
      '"HEADER_SEARCH_PATHS" => "\\"$(PODS_TARGET_SRCROOT)/common/cpp\\" $(inherited)"'
    );
    fs.writeFileSync(podspecPath, podspec, 'utf8');
    console.log('[patch-ios] Successfully patched react-native-safe-area-context.podspec with $(inherited)');
  } else {
    console.log('[patch-ios] react-native-safe-area-context.podspec already patched or pattern not found');
  }
} else {
  console.log('[patch-ios] react-native-safe-area-context.podspec not found, skipping');
}

// 2. Patch ios/Podfile
const podfilePath = path.resolve(__dirname, '../ios/Podfile');
if (fs.existsSync(podfilePath)) {
  let podfile = fs.readFileSync(podfilePath, 'utf8');
  
  const customPostInstall = `
    # --- Custom CI Patch for Xcode 16 & Sideloadly ---
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings["ENABLE_USER_SCRIPT_SANDBOXING"] = "NO"
        config.build_settings["CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES"] = "YES"
        
        # Ensure ReactCodegen and parent headers can be resolved
        hsp = config.build_settings["HEADER_SEARCH_PATHS"] || ""
        unless hsp.include?("$(inherited)")
          config.build_settings["HEADER_SEARCH_PATHS"] = "$(inherited) #{hsp}".strip
        end
      end
    end

    installer.aggregate_targets.each do |aggregate_target|
      aggregate_target.user_project.targets.each do |target|
        target.build_configurations.each do |config|
          config.build_settings["ENABLE_USER_SCRIPT_SANDBOXING"] = "NO"
          config.build_settings["CODE_SIGNING_ALLOWED"] = "NO"
          config.build_settings["CODE_SIGNING_REQUIRED"] = "NO"
        end
      end
      aggregate_target.user_project.save
    end
    # --- End Custom CI Patch ---
  `;

  if (podfile.includes('# --- Custom CI Patch')) {
    console.log('[patch-ios] ios/Podfile already contains custom CI patch');
  } else if (/post_install\s+do\s+\|installer\|/.test(podfile)) {
    podfile = podfile.replace(/(post_install\s+do\s+\|installer\|)/, `$1\n${customPostInstall}`);
    fs.writeFileSync(podfilePath, podfile, 'utf8');
    console.log('[patch-ios] Successfully patched ios/Podfile with post_install build settings');
  } else {
    // If no post_install block exists, append one
    podfile += `\n\npost_install do |installer|\n${customPostInstall}\nend\n`;
    fs.writeFileSync(podfilePath, podfile, 'utf8');
    console.log('[patch-ios] Appended post_install block to ios/Podfile');
  }
} else {
  console.log('[patch-ios] ios/Podfile does not exist yet (prebuild not run yet or run later)');
}

// 3. Patch any project.pbxproj files in ios/
const iosDir = path.resolve(__dirname, '../ios');
if (fs.existsSync(iosDir)) {
  const entries = fs.readdirSync(iosDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.endsWith('.xcodeproj')) {
      const pbxproj = path.join(iosDir, entry.name, 'project.pbxproj');
      if (fs.existsSync(pbxproj)) {
        let content = fs.readFileSync(pbxproj, 'utf8');
        content = content.replace(/ENABLE_USER_SCRIPT_SANDBOXING = YES;/g, 'ENABLE_USER_SCRIPT_SANDBOXING = NO;');
        fs.writeFileSync(pbxproj, content, 'utf8');
        console.log(`[patch-ios] Patched ${entry.name}/project.pbxproj with ENABLE_USER_SCRIPT_SANDBOXING = NO`);
      }
    }
  }
}

// 4. Patch expo-modules-jsi for Xcode 16 / Swift 6.0 compatibility
const packageSwiftPath = path.resolve(__dirname, '../node_modules/expo-modules-jsi/apple/Package.swift');
if (fs.existsSync(packageSwiftPath)) {
  let packageSwift = fs.readFileSync(packageSwiftPath, 'utf8');
  // Downgrade tools version to 6.0 for Xcode 16.2
  packageSwift = packageSwift.replace('// swift-tools-version: 6.2', '// swift-tools-version: 6.0');
  // Remove unsupported upcoming features that fail in Swift 6.0 (only in Swift 6.2+)
  packageSwift = packageSwift.replace(/\.enableUpcomingFeature\("NonisolatedNonsendingByDefault"\),\s*/g, '');
  packageSwift = packageSwift.replace(/\.enableUpcomingFeature\("InferIsolatedConformances"\),\s*/g, '');
  fs.writeFileSync(packageSwiftPath, packageSwift, 'utf8');
  console.log('[patch-ios] Successfully patched expo-modules-jsi/apple/Package.swift for Swift 6.0');
}

const buildXcframeworkScriptPath = path.resolve(__dirname, '../node_modules/expo-modules-jsi/apple/scripts/build-xcframework.sh');
if (fs.existsSync(buildXcframeworkScriptPath)) {
  let script = fs.readFileSync(buildXcframeworkScriptPath, 'utf8');
  // Forward essential macOS environment variables so syspolicyd doesn't fail on RegisterExecutionPolicyException
  script = script.replace(
    'local env_args=(PATH="$PATH" HOME="$HOME" PODS_ROOT="$PODS_ROOT" RN_ROOT="$RN_ROOT")',
    'local env_args=(PATH="$PATH" HOME="$HOME" USER="${USER:-runner}" LOGNAME="${LOGNAME:-runner}" TMPDIR="${TMPDIR:-/tmp}" SHELL="${SHELL:-/bin/bash}" PODS_ROOT="$PODS_ROOT" RN_ROOT="$RN_ROOT")'
  );
  // Remove -quiet, enable ad-hoc signing for macOS 15 Gatekeeper execution policy, and set SKIP_INSTALL=YES
  script = script.replace('-quiet \\', '');
  script = script.replace(
    /CODE_SIGNING_ALLOWED=NO \\\s*CODE_SIGNING_REQUIRED=NO \\\s*CODE_SIGN_IDENTITY="" \\/g,
    'CODE_SIGN_IDENTITY="-" \\\n    CODE_SIGNING_REQUIRED=NO \\\n    AD_HOC_CODE_SIGNING_ALLOWED=YES \\\n    CODE_SIGNING_ALLOWED=YES \\'
  );
  script = script.replace('SKIP_INSTALL=NO \\', 'SKIP_INSTALL=YES \\');
  fs.writeFileSync(buildXcframeworkScriptPath, script, 'utf8');
  console.log('[patch-ios] Successfully patched expo-modules-jsi build-xcframework.sh for macOS 15 Gatekeeper');
}


console.log('[patch-ios] Done patching.');
