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
        config.build_settings["SWIFT_CXX_INTEROPERABILITY_MODE"] = "default"
        config.build_settings["CLANG_CXX_LANGUAGE_STANDARD"] = "c++20"
        
        # Ensure C++ interop and C++20 flags are in OTHER_SWIFT_FLAGS
        osf = config.build_settings["OTHER_SWIFT_FLAGS"] || "$(inherited)"
        osf = osf.join(" ") if osf.is_a?(Array)
        unless osf.include?("-cxx-interoperability-mode")
          osf = "#{osf} -cxx-interoperability-mode=default"
        end
        unless osf.include?("-std=c++20")
          osf = "#{osf} -Xcc -std=c++20"
        end
        config.build_settings["OTHER_SWIFT_FLAGS"] = osf.strip
        
        # Ensure ReactCodegen, ExpoModulesJSI_Cxx, jsi, and Private Yoga headers can be resolved
        hsp = config.build_settings["HEADER_SEARCH_PATHS"] || ""
        hsp = hsp.join(" ") if hsp.is_a?(Array)
        extra_hsp = '"$(PODS_ROOT)/Headers/Public/ExpoModulesJSI_Cxx" "$(PODS_ROOT)/Headers/Public/jsi" "$(PODS_ROOT)/Headers/Public/React-jsi" "$(PODS_ROOT)/Headers/Private/Yoga"'
        unless hsp.include?("Headers/Private/Yoga")
          config.build_settings["HEADER_SEARCH_PATHS"] = "$(inherited) #{extra_hsp} #{hsp}".strip
        end
      end
    end
    installer.pods_project.save

    installer.aggregate_targets.each do |aggregate_target|
      aggregate_target.user_project.targets.each do |target|
        target.build_configurations.each do |config|
          config.build_settings["ENABLE_USER_SCRIPT_SANDBOXING"] = "NO"
          config.build_settings["REGISTER_EXECUTION_POLICY_EXCEPTION"] = "NO"
          config.build_settings["SWIFT_CXX_INTEROPERABILITY_MODE"] = "default"
          config.build_settings["CLANG_CXX_LANGUAGE_STANDARD"] = "c++20"
          config.build_settings["CODE_SIGNING_ALLOWED"] = "NO"
          config.build_settings["CODE_SIGNING_REQUIRED"] = "NO"
          osf = config.build_settings["OTHER_SWIFT_FLAGS"] || "$(inherited)"
          osf = osf.join(" ") if osf.is_a?(Array)
          unless osf.include?("-cxx-interoperability-mode")
            osf = "#{osf} -cxx-interoperability-mode=default"
          end
          unless osf.include?("-std=c++20")
            osf = "#{osf} -Xcc -std=c++20"
          end
          config.build_settings["OTHER_SWIFT_FLAGS"] = osf.strip

          hsp = config.build_settings["HEADER_SEARCH_PATHS"] || ""
          hsp = hsp.join(" ") if hsp.is_a?(Array)
          unless hsp.include?("Headers/Private/Yoga")
            config.build_settings["HEADER_SEARCH_PATHS"] = "$(inherited) #{extra_hsp} #{hsp}".strip
          end
        end
      end
      aggregate_target.user_project.save
    end
    # --- End Custom CI Patch ---
  `;

  if (podfile.includes('# --- Custom CI Patch')) {
    // Replace existing block to stay fresh
    podfile = podfile.replace(/# --- Custom CI Patch[\s\S]*?# --- End Custom CI Patch ---/m, customPostInstall.trim());
    fs.writeFileSync(podfilePath, podfile, 'utf8');
    console.log('[patch-ios] Successfully refreshed custom CI patch in ios/Podfile');
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

  const customModulemap = `{
    echo "module \${PACKAGE_NAME} {"
    echo "  header \\"\${PACKAGE_NAME}-Swift.h\\""
    echo "  export *"
    echo ""
    echo "  explicit module Cxx {"
    echo "    requires cplusplus"
    if (( \${#public_cxx_headers[@]} )); then
      for header in "\${public_cxx_headers[@]}"; do
        echo "    header \\"\${header}\\""
      done
    fi
    echo "    export *"
    echo "  }"
    echo "}"
    echo ""
    echo "module ExpoModulesJSI_Cxx {"
    echo "  export *"
    echo "}"
    echo ""
    echo "module jsi {"
    echo "  export *"
    echo "}"
  } > "\${headers_dir}/module.modulemap"`;

  const modulemapRegex = /\{\s*echo "module \$\{PACKAGE_NAME\} \{"[\s\S]*?\} > "\$\{headers_dir\}\/module\.modulemap"/m;
  if (modulemapRegex.test(script)) {
    script = script.replace(modulemapRegex, customModulemap);
  }

  fs.writeFileSync(buildXcframeworkScriptPath, script, 'utf8');
  console.log('[patch-ios] Successfully patched expo-modules-jsi build-xcframework.sh (BUILD_LIBRARY_FOR_DISTRIBUTION=NO, multi-module modulemap, and resilient header copy)');
}

// 5. Patch expo-modules-jsi/apple/Sources/ExpoModulesJSI-Cxx/include/RuntimeScheduler.h
// Clang in Xcode 16 / Swift 6.0 rejects SWIFT_RETURNS_RETAINED on constructors (constructors have no return type)
const runtimeSchedulerPath = path.resolve(__dirname, '../node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI-Cxx/include/RuntimeScheduler.h');
if (fs.existsSync(runtimeSchedulerPath)) {
  let content = fs.readFileSync(runtimeSchedulerPath, 'utf8');
  if (/SWIFT_RETURNS_(?:UN)?RETAINED\s+RuntimeScheduler\s*\(/.test(content)) {
    content = content.replace(/SWIFT_RETURNS_(?:UN)?RETAINED\s+RuntimeScheduler\s*\(/g, 'RuntimeScheduler(');
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

// 8. Patch ExpoModulesCore.podspec to always build from source with C++20 and C++ interop
const expoModulesCorePodspecPath = path.resolve(__dirname, '../node_modules/expo-modules-core/ExpoModulesCore.podspec');
if (fs.existsSync(expoModulesCorePodspecPath)) {
  let content = fs.readFileSync(expoModulesCorePodspecPath, 'utf8');
  if (content.includes('if (!Expo::PackagesConfig.instance.try_link_with_prebuilt_xcframework(s))')) {
    content = content.replace(
      'if (!Expo::PackagesConfig.instance.try_link_with_prebuilt_xcframework(s))',
      'if (true || !Expo::PackagesConfig.instance.try_link_with_prebuilt_xcframework(s))'
    );
  }
  if (!content.includes("'SWIFT_CXX_INTEROPERABILITY_MODE' => 'default'")) {
    content = content.replace(
      "'SWIFT_COMPILATION_MODE' => 'wholemodule',",
      "'SWIFT_COMPILATION_MODE' => 'wholemodule',\n    'SWIFT_CXX_INTEROPERABILITY_MODE' => 'default',"
    );
  }
  if (!content.includes("'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20'")) {
    content = content.replace(
      "'DEFINES_MODULE' => 'YES',",
      "'DEFINES_MODULE' => 'YES',\n    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20',"
    );
  }
  // Ensure OTHER_SWIFT_FLAGS includes both -cxx-interoperability-mode=default and -Xcc -std=c++20
  content = content.replace(
    /'OTHER_SWIFT_FLAGS'\s*=>\s*"\$\(inherited\)[^"]*"/,
    `'OTHER_SWIFT_FLAGS' => "$(inherited) -cxx-interoperability-mode=default -Xcc -std=c++20 #{new_arch_enabled ? new_arch_compiler_flags : ''}"`
  );
  fs.writeFileSync(expoModulesCorePodspecPath, content, 'utf8');
  console.log('[patch-ios] Successfully patched ExpoModulesCore.podspec to force source build with C++20 and C++ interop');
} else {
  console.log('[patch-ios] ExpoModulesCore.podspec not found, skipping');
}

// 9. Patch C++20 headers in React Native with C++17 fallbacks for Clang module importer
// When Swift imports ExpoModulesCore via -import-underlying-module, Clang compiles imported headers.
// Providing C++17 compatibility fallbacks ensures that even if Clang parses in C++17 mode, no syntax errors occur.
const yogaEnumsPath = path.resolve(__dirname, '../node_modules/react-native/ReactCommon/yoga/yoga/enums/YogaEnums.h');
if (fs.existsSync(yogaEnumsPath)) {
  let content = fs.readFileSync(yogaEnumsPath, 'utf8');
  if (!content.includes('// Patched with C++17 fallback')) {
    const patchedYogaEnums = `/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

#pragma once

// Patched with C++17 fallback for Swift Clang importer
#include <iterator>
#include <type_traits>

#if defined(__cpp_lib_bitops) && __cpp_lib_bitops >= 201907L
#include <bit>
#endif

namespace facebook::yoga {

#if defined(__cpp_concepts) && __cpp_concepts >= 201907L

template <typename EnumT>
concept Enumeration = std::is_enum_v<EnumT>;

template <Enumeration EnumT>
constexpr int32_t ordinalCount();

template <typename EnumT>
concept HasOrdinality = (ordinalCount<EnumT>() > 0);

template <HasOrdinality EnumT>
constexpr int32_t bitCount() {
  return std::bit_width(
      static_cast<std::underlying_type_t<EnumT>>(ordinalCount<EnumT>() - 1));
}

constexpr auto to_underlying(Enumeration auto e) noexcept {
  return static_cast<std::underlying_type_t<decltype(e)>>(e);
}

template <HasOrdinality EnumT>
auto ordinals() {
  struct Iterator {
    EnumT e{};

    EnumT operator*() const {
      return e;
    }

    Iterator& operator++() {
      e = static_cast<EnumT>(to_underlying(e) + 1);
      return *this;
    }

    bool operator==(const Iterator& other) const = default;
  };

  struct Range {
    Iterator begin() const {
      return Iterator{};
    }
    Iterator end() const {
      return Iterator{static_cast<EnumT>(ordinalCount<EnumT>())};
    }
  };

  return Range{};
}

#else

template <typename EnumT>
constexpr int32_t ordinalCount();

template <typename EnumT>
constexpr int32_t bitCount() {
  uint32_t x = static_cast<std::underlying_type_t<EnumT>>(ordinalCount<EnumT>() - 1);
  return x == 0 ? 0 : 32 - __builtin_clz(x);
}

template <typename EnumT>
constexpr auto to_underlying(EnumT e) noexcept {
  return static_cast<std::underlying_type_t<EnumT>>(e);
}

template <typename EnumT>
auto ordinals() {
  struct Iterator {
    EnumT e{};

    EnumT operator*() const {
      return e;
    }

    Iterator& operator++() {
      e = static_cast<EnumT>(to_underlying(e) + 1);
      return *this;
    }

    bool operator==(const Iterator& other) const {
      return e == other.e;
    }
    bool operator!=(const Iterator& other) const {
      return e != other.e;
    }
  };

  struct Range {
    Iterator begin() const {
      return Iterator{};
    }
    Iterator end() const {
      return Iterator{static_cast<EnumT>(ordinalCount<EnumT>())};
    }
  };

  return Range{};
}

#endif

} // namespace facebook::yoga
`;
    fs.writeFileSync(yogaEnumsPath, patchedYogaEnums, 'utf8');
    console.log('[patch-ios] Successfully patched YogaEnums.h with C++17 fallback');
  }
}

const fnv1aPath = path.resolve(__dirname, '../node_modules/react-native/ReactCommon/react/utils/fnv1a.h');
if (fs.existsSync(fnv1aPath)) {
  let content = fs.readFileSync(fnv1aPath, 'utf8');
  if (!content.includes('fnv1aLowercase') || !content.includes('// Patched with C++17 fallback')) {
    const patchedFnv1a = `/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

#pragma once

// Patched with C++17 fallback
#include <cstdint>
#include <functional>
#include <string_view>
#include <utility>

#include <react/utils/toLower.h>

namespace facebook::react {

#if __cplusplus >= 202002L && defined(__cpp_lib_identity)
template <typename CharTransformT = std::identity>
#else
struct Fnv1aIdentity {
  template <typename T>
  constexpr auto&& operator()(T&& val) const noexcept {
    return std::forward<T>(val);
  }
};
template <typename CharTransformT = Fnv1aIdentity>
#endif
constexpr uint32_t fnv1a(std::string_view string) noexcept
{
  constexpr uint32_t offset_basis = 2166136261;

  uint32_t hash = offset_basis;

  for (const auto &c : string) {
    hash ^= static_cast<int8_t>(CharTransformT{}(c));
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

    return hash;
  }

  constexpr uint32_t fnv1aLowercase(std::string_view string)
  {
    struct LowerCaseTransform {
      constexpr char operator()(char c) const
      {
        return toLower(c);
      }
    };

    return fnv1a<LowerCaseTransform>(string);
  }

  } // namespace facebook::react
  `;
      fs.writeFileSync(fnv1aPath, patchedFnv1a, 'utf8');
      console.log('[patch-ios] Successfully patched fnv1a.h with C++17 fallback and fnv1aLowercase');
    }
  }

const rawPropsPath = path.resolve(__dirname, '../node_modules/react-native/ReactCommon/react/renderer/core/RawProps.h');
if (fs.existsSync(rawPropsPath)) {
  let content = fs.readFileSync(rawPropsPath, 'utf8');
  if (content.includes('concept RawPropsFilterable = requires') && !content.includes('#if defined(__cpp_concepts)')) {
    content = content.replace(
      /template <typename T>\s*concept RawPropsFilterable = requires\(RawProps &rawProps\) \{\s*\{ T::filterRawProps\(rawProps\) \} -> std::same_as<void>;\s*\};/,
      `#if defined(__cpp_concepts) && __cpp_concepts >= 201907L
template <typename T>
concept RawPropsFilterable = requires(RawProps &rawProps) {
  { T::filterRawProps(rawProps) } -> std::same_as<void>;
};
#else
template <typename T, typename = void>
struct is_raw_props_filterable : std::false_type {};
template <typename T>
struct is_raw_props_filterable<T, std::void_t<decltype(T::filterRawProps(std::declval<RawProps&>()))>> : std::true_type {};
template <typename T>
constexpr bool RawPropsFilterable = is_raw_props_filterable<T>::value;
#endif`
    );
    fs.writeFileSync(rawPropsPath, content, 'utf8');
    console.log('[patch-ios] Successfully patched RawProps.h with C++17 SFINAE fallback');
  }
}

// 10. Ensure ExpoModulesJSI_Cxx and jsi Clang module maps exist in Pods/Headers/Public, and mirror Private Yoga headers
const publicHeadersDir = path.resolve(__dirname, '../ios/Pods/Headers/Public');
if (fs.existsSync(publicHeadersDir)) {
  const cxxDir = path.join(publicHeadersDir, 'ExpoModulesJSI_Cxx');
  fs.mkdirSync(cxxDir, { recursive: true });
  fs.writeFileSync(path.join(cxxDir, 'module.modulemap'), 'module ExpoModulesJSI_Cxx {\n  export *\n}\n', 'utf8');

  const jsiDir = path.join(publicHeadersDir, 'jsi');
  fs.mkdirSync(jsiDir, { recursive: true });
  fs.writeFileSync(path.join(jsiDir, 'module.modulemap'), 'module jsi {\n  export *\n}\n', 'utf8');

  const privateYogaDir = path.resolve(__dirname, '../ios/Pods/Headers/Private/Yoga');
  const publicYogaDir = path.join(publicHeadersDir, 'Yoga');
  if (fs.existsSync(privateYogaDir) && fs.existsSync(publicYogaDir)) {
    fs.cpSync(privateYogaDir, publicYogaDir, { recursive: true, force: true });
    console.log('[patch-ios] Copied Private Yoga headers to Public Yoga headers');
  }

  console.log('[patch-ios] Successfully created fallback module maps for ExpoModulesJSI_Cxx and jsi in Pods/Headers/Public');
} else {
  console.log('[patch-ios] ios/Pods/Headers/Public does not exist yet (prebuild not run yet or run later)');
}

// 11. Patch all generated .xcconfig files in ios/Pods/Target Support Files
const targetSupportDir = path.resolve(__dirname, '../ios/Pods/Target Support Files');
if (fs.existsSync(targetSupportDir)) {
  function patchXcconfigFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        patchXcconfigFiles(fullPath);
      } else if (entry.name.endsWith('.xcconfig')) {
        let text = fs.readFileSync(fullPath, 'utf8');
        let changed = false;

        if (!text.includes('CLANG_CXX_LANGUAGE_STANDARD')) {
          text += '\nCLANG_CXX_LANGUAGE_STANDARD = c++20\n';
          changed = true;
        }
        if (!text.includes('SWIFT_CXX_INTEROPERABILITY_MODE')) {
          text += '\nSWIFT_CXX_INTEROPERABILITY_MODE = default\n';
          changed = true;
        }
        if (text.includes('OTHER_SWIFT_FLAGS =')) {
          if (!text.includes('-cxx-interoperability-mode')) {
            text = text.replace('OTHER_SWIFT_FLAGS =', 'OTHER_SWIFT_FLAGS = -cxx-interoperability-mode=default');
            changed = true;
          }
          if (!text.includes('-std=c++20')) {
            text = text.replace('OTHER_SWIFT_FLAGS =', 'OTHER_SWIFT_FLAGS = -Xcc -std=c++20');
            changed = true;
          }
        }
        if (text.includes('HEADER_SEARCH_PATHS =')) {
          if (!text.includes('Headers/Private/Yoga')) {
            text = text.replace('HEADER_SEARCH_PATHS =', 'HEADER_SEARCH_PATHS = "$(PODS_ROOT)/Headers/Private/Yoga" ');
            changed = true;
          }
        }
        if (changed) {
          fs.writeFileSync(fullPath, text, 'utf8');
        }
      }
    }
  }
  patchXcconfigFiles(targetSupportDir);
  console.log('[patch-ios] Successfully patched all Pods Target Support Files .xcconfig files with C++20, C++ interop flags, and Yoga search paths');
}

// 12. Patch SwiftUIHostingView.swift in expo-modules-core
const swiftUIHostingViewPath = path.resolve(__dirname, '../node_modules/expo-modules-core/ios/Core/Views/SwiftUI/SwiftUIHostingView.swift');
if (fs.existsSync(swiftUIHostingViewPath)) {
  let content = fs.readFileSync(swiftUIHostingViewPath, 'utf8');
  let changed = false;

  // Rename private let contentView to swiftUIContentView to avoid colliding with RCTViewComponentView.contentView
  if (content.includes('private let contentView: any ExpoSwiftUI.View')) {
    content = content.replace('private let contentView: any ExpoSwiftUI.View', 'private let swiftUIContentView: any ExpoSwiftUI.View');
    changed = true;
  }

  // Concrete type instantiation and AnyView conformance
  if (content.includes('self.contentView = ContentView(props: props)')) {
    content = content.replace(
      /self\.contentView = ContentView\(props: props\)\s*let rootView = AnyView\(contentView\)/,
      'let concreteContentView = ContentView(props: props)\n      self.swiftUIContentView = concreteContentView\n      let rootView = AnyView(concreteContentView)'
    );
    changed = true;
  }

  // Resolve sizingOptions contextual type
  if (content.includes('controller.sizingOptions = [.intrinsicContentSize]')) {
    content = content.replace(
      'controller.sizingOptions = [.intrinsicContentSize]',
      'controller.sizingOptions = [UIHostingControllerSizingOptions.intrinsicContentSize]'
    );
    changed = true;
  }

  // Return swiftUIContentView in getContentView()
  if (content.includes('return contentView')) {
    content = content.replace(
      /public func getContentView\(\) -> any ExpoSwiftUI\.View \{\s*return contentView\s*\}/,
      'public func getContentView() -> any ExpoSwiftUI.View {\n      return swiftUIContentView\n    }'
    );
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(swiftUIHostingViewPath, content, 'utf8');
    console.log('[patch-ios] Successfully patched SwiftUIHostingView.swift in expo-modules-core');
  }
}

// 13. Patch EventEmitter.swift in expo-modules-core
// Wrap self in NonisolatedUnsafeWeakVar to avoid Swift 6 data-race errors when sending into JavaScriptActor closure
const eventEmitterPath = path.resolve(__dirname, '../node_modules/expo-modules-core/ios/Core/Events/EventEmitter.swift');
if (fs.existsSync(eventEmitterPath)) {
  let content = fs.readFileSync(eventEmitterPath, 'utf8');
  let changed = false;

  if (content.includes('nonisolated(unsafe) weak let emitter = self')) {
    content = content.replaceAll(
      'nonisolated(unsafe) weak let emitter = self',
      'let emitterBox = NonisolatedUnsafeWeakVar(self)'
    );
    content = content.replaceAll(
      'guard let emitter else {',
      'guard let emitter = emitterBox.value else {'
    );
    content = content.replaceAll(
      'guard let emitter, let appContext else {',
      'guard let emitter = emitterBox.value, let appContext else {'
    );
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(eventEmitterPath, content, 'utf8');
    console.log('[patch-ios] Successfully patched EventEmitter.swift in expo-modules-core with NonisolatedUnsafeWeakVar');
  }
}

console.log('[patch-ios] Done patching.');


