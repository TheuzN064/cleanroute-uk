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

console.log('[patch-ios] Done patching.');
