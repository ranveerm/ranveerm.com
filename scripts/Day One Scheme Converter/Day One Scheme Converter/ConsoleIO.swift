//
//  ConsoleIO.swift
//  Day One Scheme Converter
//
//  Created by Ranveer Mamidpelliwar on 7/3/2022.
//

import Foundation

class ConsoleIO {
    enum OutputType {
        case error
        case standard
    }
    
    func writeMessage(_ message: String, to outputType: OutputType = .standard) {
        switch outputType {
        case .standard: print("\(message)")
        case .error: fputs("Error: \(message)\n", stderr)
        }
    }
    
    func printUsage() {
        writeMessage("usage: ")
        writeMessage("<executableName> <root dir>")
        writeMessage("")
        writeMessage("Expected Root Direcotry structure:")
        
        let expectedDirectoryStructure = """
└── <year>
    ├── DayOne exports
    │   ├── [<DayOne export>.zip]
    │   ├── ...
    │   │
    │   ├── [<category zip unwrapped>]
    │   │   ├── Journal.json
    │   │   └── photos
    │   │       ├── [<photo ID>.png]
    │   │       └── ...
    │   └── ...
    │
    ├── [<category>-modifier.json]
    ├── ...
    │
    ├── [<category>-processed.json]
    ├── ...
    │
    └── Images combined
        ├── [<photo ID>.png]
        └── ...
"""
        writeMessage(expectedDirectoryStructure)
    }
}
