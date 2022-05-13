//
//  main.swift
//  Day One Scheme Converter
//
//  Created by Ranveer Mamidpelliwar on 7/3/2022.
//

import Foundation

class MainProgram {
    let consoleIO = ConsoleIO()
    static let requiredArguments = 3
    let journal = DayOneJournal.movies
    
    func convertData() {
        guard CommandLine.argc == MainProgram.requiredArguments else {
            print("Please check that the correct number of arguments are passed in")
            return
        }
        
        let inputFile = CommandLine.arguments[1]
        let outputFile = CommandLine.arguments[2] + journal.processedOutputFileName
        
        guard let data = try? Data(contentsOf: .init(fileURLWithPath: inputFile), options: .mappedIfSafe) else {
            print("Unable to construct URL from input file path")
            return
        }
        
        guard let decodedData = try? JSONDecoder().decode(DayOneExport.self, from: data) else {
            print("Unable to decaode JSON data object")
            return
        }
        
        let mediaCellObjects: [MediaCellObject] = decodedData.entries.map { entry in
            /// [What is the more elegant way to remove all characters after specific character in the String object in Swift](https://stackoverflow.com/a/57769796/13257784)
            let markdownText = entry.text
            let relevantTextIndex = markdownText.range(of: "\n\n---\n\n")?.lowerBound
            let relevantString = String(markdownText.prefix(upTo: relevantTextIndex ?? markdownText.endIndex))
            
            let relevantStringSplit = relevantString
                .replacingOccurrences(of: "### ", with: "")
                .replacingOccurrences(of: "# ", with: "")
                .replacingOccurrences(of: "\\", with: "")
                .components(separatedBy: "\n\n")
            
            let includesSubtitle = relevantStringSplit.count == 4
            
            let title = relevantStringSplit[0]
            let subtitle = includesSubtitle ? relevantStringSplit[1] : ""
            let description = relevantStringSplit[includesSubtitle ? 3 : 2]
            let photoObject = entry.photos[0]
            
            return .init(date: .now,
                         photo: photoObject.md5 + "." + photoObject.type,
                         title: title, subtitle: subtitle,
                         description: description)
        }
        
        let mediaCellObjectCollection = MediaCellObjectCollection(entries: mediaCellObjects)
        
        do { try JSONEncoder().encode(mediaCellObjectCollection).write(to: .init(fileURLWithPath: outputFile)) }
        catch { print("Unable to save JSON object to specified file") }
    }
    
    func mock() {
        guard CommandLine.argc == MainProgram.requiredArguments else {
            consoleIO.writeMessage("Please check that the correct number of arguments are passed in")
            return
        }
        
        let contentDir = ContentRootDirectoryObject(path: CommandLine.arguments[1])
        guard let year = contentDir.year else {
            consoleIO.writeMessage("Unable to determine year for journal data", to: .error)
            return
        }
        let photoAssestsPahth = CommandLine.arguments[2] + year + "/" + Constants.photoAssetsDirectoryName
        
        print(photoAssestsPahth)
        if doesFileExist(photoAssestsPahth) {
            shell("rm -rf \(photoAssestsPahth) && mkdir \(photoAssestsPahth)")
        } else { shell("mkdir \(photoAssestsPahth)") }
        
        for journal in DayOneJournal.allCases {
            defer { consoleIO.writeMessage("") }
            let journalExportPath = contentDir.dayOneSrcDir + "/" + "\"\(journal.dayOneCompressedExport)\""
            
            let journalUnzipPath = contentDir.dayOneSrcDir + "/" + "\"\(journal.rawValue)\""
            
            let journalPhotosPath = journalUnzipPath + "/" + Constants.journalPhotosPath
            let journalDataPath = journalUnzipPath + "/" + Constants.journalDataFileName
            
            if !doesFileExist(journalExportPath) {
                consoleIO.writeMessage("Could not find \(journal.rawValue) Journal export- skipping", to: .error)
                continue
            }
            
            /// If unzipped directory already exists, it needs to be deleted. Failure to do this results in the program hanging
            if doesFileExist(journalUnzipPath) {
                shell("rm -rf \(journalUnzipPath)")
            }
            
            consoleIO.writeMessage("--- Processing \(journal.rawValue) Journal ---")
            shell("unzip \(journalExportPath) -d \(journalUnzipPath)")
            defer { shell("rm -rf \(journalUnzipPath)") }
            
            if !doesFileExist(journalDataPath) {
                consoleIO.writeMessage("Could not find \(journal.rawValue) Journal data file- skipping", to: .error)
                continue
            }
            
            /// The format specifying the path for `URL` needs to remove occurances of `"`
            let journalDataURL = URL(fileURLWithPath: journalDataPath.replacingOccurrences(of: "\"", with: ""))
            guard let journalData = try? Data(contentsOf: journalDataURL,
                                              options: .mappedIfSafe) else {
                consoleIO.writeMessage("Unable to import data for \(journal.rawValue) Journal", to: .error)
                continue
            }
 
            guard let decodedData = try? JSONDecoder()
                .decode(DayOneExport.self, from: journalData) else {
                consoleIO.writeMessage("Unable to decaode JSON data for \(journal.rawValue) Journal", to: .error)
                return
            }
            
            let mediaCellObjects: [MediaCellObject] = decodedData.entries.map(MediaCellObject.init)
            let mediaCellObjectCollection = MediaCellObjectCollection(entries: mediaCellObjects)
            
            let outputPath = contentDir.path + "/" + journal.rawValue + "-processed.json"
            if doesFileExist(outputPath) { shell("rm -rf \(outputPath)") }
            do {
                try JSONEncoder()
                    .encode(mediaCellObjectCollection)
                    .write(to: .init(fileURLWithPath: outputPath))
                consoleIO.writeMessage("Sucessfully processed data")
            }
            catch { consoleIO.writeMessage("Unable to save processed JSON data to specified file for \(journal.rawValue) Journal", to: .error) }
            
            shell("cp -a \(journalPhotosPath)/. \(photoAssestsPahth)/")
        }
    }
    
    func doesFileExist(_ filename: String) -> Bool {
        !shell("ls -la \(filename)").contains("No such file or directory")
    }
}

let program = MainProgram()

if CommandLine.argc != MainProgram.requiredArguments { program.consoleIO.printUsage() }
else { program.mock() }
