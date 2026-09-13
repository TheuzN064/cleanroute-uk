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
        config.build_settings["REGISTER_EXECUTION_POLICY_EXCEPTION"] = "NO"
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
          config.build_settings["REGISTER_EXECUTION_POLICY_EXCEPTION"] = "NO"
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
  // Remove module interface flags that cause EmitSwiftModule and SwiftEmitModule failures on Swift 6 with C++ interop
  packageSwift = packageSwift.replace(/\s*"-enable-library-evolution",/g, '');
  packageSwift = packageSwift.replace(/\s*"-emit-module-interface",/g, '');
  packageSwift = packageSwift.replace(/\s*"-no-verify-emitted-module-interface",/g, '');
  fs.writeFileSync(packageSwiftPath, packageSwift, 'utf8');
  console.log('[patch-ios] Successfully patched expo-modules-jsi/apple/Package.swift for Swift 6.0 (disabled module interface generation)');
}

const buildXcframeworkScriptPath = path.resolve(__dirname, '../node_modules/expo-modules-jsi/apple/scripts/build-xcframework.sh');
if (fs.existsSync(buildXcframeworkScriptPath)) {
  let script = fs.readFileSync(buildXcframeworkScriptPath, 'utf8');
  // Forward essential macOS environment variables so syspolicyd doesn't fail on RegisterExecutionPolicyException
  script = script.replace(
    'local env_args=(PATH="$PATH" HOME="$HOME" PODS_ROOT="$PODS_ROOT" RN_ROOT="$RN_ROOT")',
    'local env_args=(PATH="$PATH" HOME="$HOME" USER="${USER:-runner}" LOGNAME="${LOGNAME:-runner}" TMPDIR="${TMPDIR:-/tmp}" SHELL="${SHELL:-/bin/bash}" PODS_ROOT="$PODS_ROOT" RN_ROOT="$RN_ROOT")'
  );

  const xcbuildPatch = `REGISTER_EXECUTION_POLICY_EXCEPTION=NO \\
    ENABLE_USER_SCRIPT_SANDBOXING=NO \\
    CODE_SIGN_IDENTITY="-" \\
    CODE_SIGNING_REQUIRED=NO \\
    AD_HOC_CODE_SIGNING_ALLOWED=YES \\
    CODE_SIGNING_ALLOWED=YES \\`;

  if (script.includes('-quiet \\')) {
    script = script.replace('-quiet \\', xcbuildPatch);
  } else if (!script.includes('REGISTER_EXECUTION_POLICY_EXCEPTION=NO')) {
    script = script.replace(
      '-configuration "$CONFIGURATION" \\',
      `-configuration "$CONFIGURATION" \\\n    ${xcbuildPatch}`
    );
  }

  script = script.replace('BUILD_LIBRARY_FOR_DISTRIBUTION=YES \\', 'BUILD_LIBRARY_FOR_DISTRIBUTION=NO \\');
  script = script.replace('SKIP_INSTALL=NO \\', 'SKIP_INSTALL=YES \\');
  script = script.replace(
    'cp "${generated_maps}/${PACKAGE_NAME}-Swift.h" "$headers_dir/"',
    'if [[ -f "${generated_maps}/${PACKAGE_NAME}-Swift.h" ]]; then cp "${generated_maps}/${PACKAGE_NAME}-Swift.h" "$headers_dir/"; else find "${DERIVED_DATA_PATH}" -name "${PACKAGE_NAME}-Swift.h" -exec cp {} "$headers_dir/" \\; -quit || true; fi'
  );
  fs.writeFileSync(buildXcframeworkScriptPath, script, 'utf8');
  console.log('[patch-ios] Successfully patched expo-modules-jsi build-xcframework.sh (BUILD_LIBRARY_FOR_DISTRIBUTION=NO and resilient header copy)');
}

// 5. Patch expo-modules-jsi/apple/Sources/ExpoModulesJSI-Cxx/include/RuntimeScheduler.h
// Clang in Xcode 16 / Swift 6.0 rejects SWIFT_RETURNS_RETAINED on constructors (constructors have no return type)
const runtimeSchedulerPath = path.resolve(__dirname, '../node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI-Cxx/include/RuntimeScheduler.h');
if (fs.existsSync(runtimeSchedulerPath)) {
  let content = fs.readFileSync(runtimeSchedulerPath, 'utf8');
  if (content.includes('SWIFT_RETURNS_RETAINED RuntimeScheduler(')) {
    content = content.replaceAll('SWIFT_RETURNS_RETAINED RuntimeScheduler(', 'RuntimeScheduler(');
    fs.writeFileSync(runtimeSchedulerPath, content, 'utf8');
    console.log('[patch-ios] Successfully patched RuntimeScheduler.h (removed invalid SWIFT_RETURNS_RETAINED on constructors)');
  } else {
    console.log('[patch-ios] RuntimeScheduler.h already patched or pattern not found');
  }
} else {
  console.log('[patch-ios] RuntimeScheduler.h not found, skipping');
}

// 6. Patch expo-modules-jsi/apple/Sources/ExpoModulesJSI/Runtime/JavaScriptRuntime.swift
// In Swift 6.0, capturing non-Sendable raw pointers into JavaScriptActor.assumeIsolated triggers
// "error: sending 'resultPtr' risks causing data races". Use NonisolatedUnsafeVar box instead.
const jsRuntimePath = path.resolve(__dirname, '../node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Runtime/JavaScriptRuntime.swift');
if (fs.existsSync(jsRuntimePath)) {
  let jsRuntime = fs.readFileSync(jsRuntimePath, 'utf8').replace(/\r\n/g, '\n');

  // Patch getter (lines 188-193)
  if (jsRuntime.includes('nonisolated(unsafe) let resultPtr = resultPtr')) {
    jsRuntime = jsRuntime.replace(
      'nonisolated(unsafe) let resultPtr = resultPtr\n\n      return withGuaranteedContext(context) { (context: HostObjectContext, runtime) in\n        return JavaScriptActor.assumeIsolated {\n          return forwardingSwiftErrorsToJS(runtime: runtime) {\n            try context.get(propertyName).writeJSIValue(to: resultPtr)\n          }\n        }\n      }',
      'let resultPtrBox = NonisolatedUnsafeVar(resultPtr)\n\n      return withGuaranteedContext(context) { (context: HostObjectContext, runtime) in\n        return JavaScriptActor.assumeIsolated {\n          return forwardingSwiftErrorsToJS(runtime: runtime) {\n            try context.get(propertyName).writeJSIValue(to: resultPtrBox.value)\n          }\n        }\n      }'
    );
    console.log('[patch-ios] Successfully patched JavaScriptRuntime.swift getter with NonisolatedUnsafeVar');
  }

  // Patch createFunctionClosure (owning this, lines 777-792)
  if (jsRuntime.includes('let this = UnsafeMutablePointer(mutating: thisPtr).move()')) {
    jsRuntime = jsRuntime.replace(
      '    nonisolated(unsafe) let thisPtr = thisPtr\n    nonisolated(unsafe) let argumentsPtr = argumentsPtr\n    nonisolated(unsafe) let resultPtr = resultPtr\n\n    // See `withGuaranteedContext` for why neither the context nor the runtime is retained here, and\n    // why the result is written to the caller\'s slot instead of being returned.\n    return withGuaranteedContext(context) { (context: HostFunctionContext, runtime) in\n      return JavaScriptActor.assumeIsolated {\n        return forwardingSwiftErrorsToJS(runtime: runtime) {\n          let this = UnsafeMutablePointer(mutating: thisPtr).move()\n          let arguments = JavaScriptValuesBuffer(runtime, start: argumentsPtr, count: argumentsCount)\n          let thisValue = JavaScriptValue(runtime, this)\n          try context.call(thisValue, consume arguments).writeJSIValue(to: resultPtr)\n        }\n      }\n    }',
      '    let thisPtrBox = NonisolatedUnsafeVar(thisPtr)\n    let argumentsPtrBox = NonisolatedUnsafeVar(argumentsPtr)\n    let resultPtrBox = NonisolatedUnsafeVar(resultPtr)\n\n    // See `withGuaranteedContext` for why neither the context nor the runtime is retained here, and\n    // why the result is written to the caller\'s slot instead of being returned.\n    return withGuaranteedContext(context) { (context: HostFunctionContext, runtime) in\n      return JavaScriptActor.assumeIsolated {\n        return forwardingSwiftErrorsToJS(runtime: runtime) {\n          let this = UnsafeMutablePointer(mutating: thisPtrBox.value).move()\n          let arguments = JavaScriptValuesBuffer(runtime, start: argumentsPtrBox.value, count: argumentsCount)\n          let thisValue = JavaScriptValue(runtime, this)\n          try context.call(thisValue, consume arguments).writeJSIValue(to: resultPtrBox.value)\n        }\n      }\n    }'
    );
    console.log('[patch-ios] Successfully patched JavaScriptRuntime.swift createFunctionClosure (owning this) with NonisolatedUnsafeVar');
  }

  // Patch createFunctionClosure (unowned this, lines 820-835)
  if (jsRuntime.includes('let thisValue = JavaScriptUnownedValue(runtime.pointee, thisPtr)')) {
    jsRuntime = jsRuntime.replace(
      '    nonisolated(unsafe) let thisPtr = thisPtr\n    nonisolated(unsafe) let argumentsPtr = argumentsPtr\n    nonisolated(unsafe) let resultPtr = resultPtr\n\n    // See `withGuaranteedContext` for why neither the context nor the runtime is retained here, and\n    // why the result is written to the caller\'s slot instead of being returned.\n    return withGuaranteedContext(context) { (context: UnownedThisHostFunctionContext, runtime) in\n      return JavaScriptActor.assumeIsolated {\n        return forwardingSwiftErrorsToJS(runtime: runtime) {\n          let arguments = JavaScriptValuesBuffer(runtime, start: argumentsPtr, count: argumentsCount)\n          let thisValue = JavaScriptUnownedValue(runtime.pointee, thisPtr)\n          try context.call(thisValue, consume arguments).writeJSIValue(to: resultPtr)\n        }\n      }\n    }',
      '    let thisPtrBox = NonisolatedUnsafeVar(thisPtr)\n    let argumentsPtrBox = NonisolatedUnsafeVar(argumentsPtr)\n    let resultPtrBox = NonisolatedUnsafeVar(resultPtr)\n\n    // See `withGuaranteedContext` for why neither the context nor the runtime is retained here, and\n    // why the result is written to the caller\'s slot instead of being returned.\n    return withGuaranteedContext(context) { (context: UnownedThisHostFunctionContext, runtime) in\n      return JavaScriptActor.assumeIsolated {\n        return forwardingSwiftErrorsToJS(runtime: runtime) {\n          let arguments = JavaScriptValuesBuffer(runtime, start: argumentsPtrBox.value, count: argumentsCount)\n          let thisValue = JavaScriptUnownedValue(runtime.pointee, thisPtrBox.value)\n          try context.call(thisValue, consume arguments).writeJSIValue(to: resultPtrBox.value)\n        }\n      }\n    }'
    );
    console.log('[patch-ios] Successfully patched JavaScriptRuntime.swift createFunctionClosure (unowned this) with NonisolatedUnsafeVar');
  }

  fs.writeFileSync(jsRuntimePath, jsRuntime, 'utf8');
} else {
  console.log('[patch-ios] JavaScriptRuntime.swift not found, skipping');
}

// 7. Patch expo-modules-autolinking to disable precompiled modules
// Precompiled Expo modules shipped in npm were built with Swift 6.3.1, causing
// fatal compiler mismatch errors on Xcode 16 (Swift 6.2.4).
// Forcing enabled? to false ensures all Expo modules build cleanly from source with Xcode 16.
const precompiledModulesRbPath = path.resolve(__dirname, '../node_modules/expo-modules-autolinking/scripts/ios/precompiled_modules.rb');
if (fs.existsSync(precompiledModulesRbPath)) {
  let content = fs.readFileSync(precompiledModulesRbPath, 'utf8');
  if (!content.includes('def enabled?\n        false\n      end')) {
    content = content.replace(
      /def enabled\?[\s\S]*?end\s*\n\s*def configure/m,
      "def enabled?\n        false\n      end\n\n      def configure"
    );
    fs.writeFileSync(precompiledModulesRbPath, content, 'utf8');
    console.log('[patch-ios] Successfully patched precompiled_modules.rb to disable incompatible precompiled modules');
  } else {
    console.log('[patch-ios] precompiled_modules.rb already patched');
  }
} else {
  console.log('[patch-ios] precompiled_modules.rb not found, skipping');
}

// 8. Patch ExpoModulesCore.podspec to always build from source
const expoModulesCorePodspecPath = path.resolve(__dirname, '../node_modules/expo-modules-core/ExpoModulesCore.podspec');
if (fs.existsSync(expoModulesCorePodspecPath)) {
  let content = fs.readFileSync(expoModulesCorePodspecPath, 'utf8');
  if (content.includes('if (!Expo::PackagesConfig.instance.try_link_with_prebuilt_xcframework(s))')) {
    content = content.replace(
      'if (!Expo::PackagesConfig.instance.try_link_with_prebuilt_xcframework(s))',
      'if (true || !Expo::PackagesConfig.instance.try_link_with_prebuilt_xcframework(s))'
    );
    fs.writeFileSync(expoModulesCorePodspecPath, content, 'utf8');
    console.log('[patch-ios] Successfully patched ExpoModulesCore.podspec to force source build');
  } else {
    console.log('[patch-ios] ExpoModulesCore.podspec already patched or pattern not found');
  }
} else {
  console.log('[patch-ios] ExpoModulesCore.podspec not found, skipping');
}

console.log('[patch-ios] Done patching.');

