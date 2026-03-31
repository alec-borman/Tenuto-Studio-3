use tenutoc::xml::XmlEmitter;

#[test]
fn test_c_sharp_followed_by_c_natural() {
    let mut emitter = XmlEmitter::new(0); // C Major
    
    // C#4 (MIDI 61)
    let xml1 = emitter.generate_note_xml(61);
    assert!(xml1.contains("<accidental>sharp</accidental>"));
    
    // C4 (MIDI 60)
    let xml2 = emitter.generate_note_xml(60);
    assert!(xml2.contains("<accidental>natural</accidental>"));
}

#[test]
fn test_c_sharp_octave_isolation() {
    let mut emitter = XmlEmitter::new(0); // C Major
    
    // C#4 (MIDI 61)
    let xml1 = emitter.generate_note_xml(61);
    assert!(xml1.contains("<accidental>sharp</accidental>"));
    
    // C#5 (MIDI 73)
    let xml2 = emitter.generate_note_xml(73);
    assert!(xml2.contains("<accidental>sharp</accidental>"));
}
