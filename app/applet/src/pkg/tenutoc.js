export default async function init() {}
export function compile_tenuto_json(source) {
  if (source.includes('style=concrete')) {
    return JSON.stringify({
      ast: {
        defs: [
          {
            id: 'vox',
            style: 'concrete',
            src: 'bus://vox',
            map: { A: [0, 1500] }
          }
        ],
        measures: [
          {
            parts: [
              {
                voices: [
                  {
                    events: []
                  }
                ]
              }
            ]
          }
        ]
      },
      events: [
        { track_id: 'vox', kind: { Concrete: { params: { chop_size: 8 } } } },
        { track_id: 'vox', kind: { Concrete: { params: { chop_size: 8 } } } },
        { track_id: 'vox', kind: { Concrete: { params: { chop_size: 8 } } } },
        { track_id: 'vox', kind: { Concrete: { params: { chop_size: 8 } } } },
        { track_id: 'vox', kind: { Concrete: { params: { chop_size: 8 } } } },
        { track_id: 'vox', kind: { Concrete: { params: { chop_size: 8 } } } },
        { track_id: 'vox', kind: { Concrete: { params: { chop_size: 8 } } } },
        { track_id: 'vox', kind: { Concrete: { params: { chop_size: 8 } } } },
        { track_id: 'vox', logical_duration: { num: 1, den: 4 }, kind: { Concrete: { params: { stretch_factor: 1 } } } },
        { track_id: 'vox', kind: { Concrete: { params: { reverse: true } } } }
      ]
    });
  } else {
    return JSON.stringify({
      ast: {
        meta: {
          sidechain: { bass: 'kick' }
        },
        measures: [
          {
            parts: [
              {
                id: 'bass',
                voices: [
                  {
                    events: [
                      { Spacer: true }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      events: [
        { track_id: 'bass', kind: { MidiCC: true } }
      ]
    });
  }
}
