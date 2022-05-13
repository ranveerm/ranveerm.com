//
//  Day One Objects.swift
//  Day One Scheme Converter
//
//  Created by Ranveer Mamidpelliwar on 7/3/2022.
//

import Foundation

struct DayOneExport: Codable {
    let entries: [DayOneObject]
}

struct DayOnePhotoMetadata: Codable {
    let md5: String
    let type: String
}

struct DayOneObject: Codable {
    let creationDate: String
    let text: String
    let photos: [DayOnePhotoMetadata]
}

enum DayOneJournal: String, CaseIterable {
    case books = "Books"
    case movies = "Movies"
    case tvShows = "TV-shows"
    case games = "Games"
    case beverages = "Beverages"
    
    var dayOneCompressedExport: String { self.rawValue + ".zip" }
    var modifierFileName: String { self.rawValue + "-modifier" + ".json" }
    var processedOutputFileName: String { self.rawValue + "-prcoessed" + ".json" }
}
