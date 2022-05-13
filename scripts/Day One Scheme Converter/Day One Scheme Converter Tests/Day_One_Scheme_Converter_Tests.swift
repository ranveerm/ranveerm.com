//
//  Day_One_Scheme_Converter_Tests.swift
//  Day One Scheme Converter Tests
//
//  Created by Ranveer Mamidpelliwar on 8/5/2022.
//

import XCTest
@testable import Day_One_Scheme_Converter

class Day_One_Scheme_Converter_Tests: XCTestCase {
    override func setUpWithError() throws { }

    override func tearDownWithError() throws { }

    func test_mediaCellObjectInitialisationViaDayOneJournal () {
        /// Given
        let creationDateString = "2022-05-05T12:41:52Z"
        let inputString = "# The Mandalorian\n\n### Season 1\n\n![](dayone-moment:6975F3D9070C44068FEAD92E7B346457)\n\nRefreshing to experience a slow paced sci\\-fi show\\."
        
        let expectedDate = DateComponents(calendar: .init(identifier: .gregorian), year: 2022, month: 05, day: 05).date!
        let expectedOutput = MediaCellObject(date: expectedDate,
                                             photo: "6491db57e0e922a63bc605f166147ad2.jpeg",
                                             title: "The Mandalorian", subtitle: "Season 1",
                                             description: "Refreshing to experience a slow paced sci-fi show.")
        
        let dayOneObject = DayOneObject(creationDate: creationDateString,
                                        text: inputString,
                                        photos: [.init(md5: "6491db57e0e922a63bc605f166147ad2", type: "jpeg")])
        
        /// When
        let computedOutput = MediaCellObject(dayOneObject)
        
        /// Then
        XCTAssertEqual(expectedOutput.title, computedOutput.title)
        XCTAssertEqual(expectedOutput.subtitle, computedOutput.subtitle)
        XCTAssertEqual(expectedOutput.description, computedOutput.description)
        XCTAssertEqual(expectedOutput.photo, computedOutput.photo)
    }
}
