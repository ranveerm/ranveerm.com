//
//  Utilities.swift
//  Day One Scheme Converter
//
//  Created by Ranveer Mamidpelliwar on 4/4/2022.
//

import Foundation

/**
 Collection of utilities used by project. Functions are implemented with global scope given- 1) it has a minimal impact given they the nature of the target (Aggregated) and 2) the convenience it offers.
 
 ### Accessing Environment Vairables
 Evironment variables are set under "Build Settings" for the respective project/target and can be accessed within the code. If an environment variable represents a path in the file system, use `retrieveEnvironmentVariablePath` if-
    1. It is intended to access the variable within swift as a `String` and
    2. The **intention is to pass this into a shell script** after accessing it within swift
 The above method undertakes the responsibility of pre-fixing a spance in the path variable with `\`, such that it can be used within shell as intended.
 
 Alternatively, environment vairables are directly passed into shell by using `${<variable name>}` syntax, as the shell script as part of "Build Phase" inherits the environment supplied by Xcode. In the instance where a shell command is first specified as `String` in Swift before being processed by shell, ensure the above variable is in the form `\"${<variable name>}\"` to ensure spaces are processed appropriately **if used as an argument**.
 */

/**
 Execute shell commands within Swift code.
 - Author: [ranveerm](https://github.com/ranveerm) 👨🏾‍💻
 # Reference:
    - [Using Swift Scripts with Xcode](https://www.raywenderlich.com/25816315-using-swift-scripts-with-xcode#toc-anchor-009)
    - [How do I run a terminal command in a Swift script? (e.g. xcodebuild)](https://stackoverflow.com/questions/26971240/how-do-i-run-a-terminal-command-in-a-swift-script-e-g-xcodebuild)
 */
@discardableResult func shell(_ command: String) -> String {
    let task = Process()
    let pipe = Pipe()
    
    task.standardOutput = pipe
    task.standardError = pipe
    task.arguments = ["-c", command]
    task.launchPath = "/bin/zsh"
    task.launch()
    
    let data = pipe.fileHandleForReading.readDataToEndOfFile()
    let output = String(data: data, encoding: .utf8) ?? ""
    
    return output
}

/**
 Wrapper around `shell` command, that prints output.
 - Author: [ranveerm](https://github.com/ranveerm) 👨🏾‍💻
 */
@discardableResult func shellOut(_ command: String) -> String {
    printInShell(command)
    
    let output = shell(command)
    print(output)
    
    return output
}

/**
 Wrapper around `echo` command in `bash`.
 This command is useful to to chack vairables that are anticipated to be expanded in `bash`.
 - Author: [ranveerm](https://github.com/ranveerm) 👨🏾‍💻
 */
func printInShell(_ input: String) { print(shell("echo \(input)"), terminator: "") }

func retrieveEnvironmentVariable(_ envVar: String) -> String? { ProcessInfo.processInfo.environment[envVar] }

/**
 Function to retrieve Xcode environment path variables. A special function is required for this purpose (as opposed to `retrieveEnvironmentVariable`) as path variables might have spaces, which need to be escaped if they are being used on other contexts.
 - Author: [ranveerm](https://github.com/ranveerm) 👨🏾‍💻
 */
func retrieveEnvironmentVariablePath(_ envVar: String) -> String? { retrieveEnvironmentVariable(envVar)?.replacingOccurrences(of: " ", with: "\\ ") }

/**
 Wrapper for `shellOut` with the added functinoality of
    - Accepting a descrption that is printed before executing the command
    - Executing multiple commands
 - Author: [ranveerm](https://github.com/ranveerm) 👨🏾‍💻
 */
func shellOutWithDescription(_ commandWithDescriptions: [(descriptionToPrint: String, command: String)]) {
    commandWithDescriptions.forEach {
        printInShell($0.descriptionToPrint)
        _ = shellOut($0.command)
    }
}

/**
 Return a shell command to append the specified string to the end of a file **only if it dosen't already exist in the file**.
 # Reference: [Appending a line to a file only if it does not already exist](https://stackoverflow.com/questions/3557037/appending-a-line-to-a-file-only-if-it-does-not-already-exist)
 - Author: [ranveerm](https://github.com/ranveerm) 👨🏾‍💻
 */
func appendToFileOnlyIfDosentExistsCommand(pattern: String, file: String) -> String {
    "grep -qxF '\(pattern)' \(file) || echo '\(pattern)' >> \(file)"
}
