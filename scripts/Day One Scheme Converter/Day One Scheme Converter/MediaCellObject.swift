//
//  MediaCellObject.swift
//  Day One Scheme Converter
//
//  Created by Ranveer Mamidpelliwar on 7/3/2022.
//

import Foundation

struct MediaCellObject: Codable {
    let date: Date
    let photo: String
    let title: String
    let subtitle: String
    let description: String
}

/**
 Rules for decoding from `DayOneObject`-
    - `DayOneObject` can contain multiple photo objects. Only the first is considered
    - All content after `\n\n---\n\n` is discarded
    - Prefix of `# ` denotes `title`
    - Prefix of `### ` denotes `subtitle`
    - Text with no formatting denotes `description`
 - Author: [ranveerm](https://github.com/ranveerm) 👨🏾‍💻
 */
extension MediaCellObject {
    init(_ dayOneObject: DayOneObject) {
        let photoObject = dayOneObject.photos.first ?? .init(md5: "", type: "")
        
        let markdownText = dayOneObject.text
        
        /// [What is the more elegant way to remove all characters after specific character in the String object in Swift](https://stackoverflow.com/a/57769796/13257784)
        let relevantTextIndex = markdownText.range(of: "\n\n---\n\n")?.lowerBound
        let relevantMarkdownText = String(markdownText.prefix(upTo: relevantTextIndex ?? markdownText.endIndex))
        
        let objectComponents = relevantMarkdownText
            /// Replacing Markdown and escaping characters
            .replacingOccurrences(of: "\\", with: "")
            .components(separatedBy: "\n\n")
            /// Removing lines referencing images
            .filter { !$0.contains("dayone-moment") }
        
        var title = ""
        var subtitle = ""
        var description = ""
        
        objectComponents.forEach {
            /// "### " check needs to occur before "# " check as the later is a subset of the former.
            if $0.contains("### ") { subtitle = $0.replacingOccurrences(of: "### ", with: "") }
            else if $0.contains("# ") { title = $0.replacingOccurrences(of: "# ", with: "") }
            else { description = $0 }
        }
        
        self.init(date: .now,
                  photo: photoObject.md5 + "." + photoObject.type,
                  title: title, subtitle: subtitle,
                  description: description)
    }
}

struct MediaCellObjectCollection: Codable {
    let entries: [MediaCellObject]
}
