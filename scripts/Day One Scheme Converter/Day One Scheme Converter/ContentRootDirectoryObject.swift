//
//  ContentRootDirectoryObject.swift
//  Day One Scheme Converter
//
//  Created by Ranveer Mamidpelliwar on 2/5/2022.
//

import Foundation

struct ContentRootDirectoryObject {
    /// Path containins a trailing `/`
    let path: String
    
    var dayOneSrcDir: String { "\"\(path)\(Constants.dayOneSrcDirName)\"" }
    var year: String? { URL(string: path)?.lastPathComponent }
}
