# Music sources

The first four MP3s were supplied by the user for this game as royalty-free music.
The fifth was supplied for the peaceful lands on 23 October 2026.
No source URLs or license documents were supplied. All are copied byte for byte;
no transcoding, normalization, or edits were applied.

The files contain no embedded title or artist tags. The labels and creator
handles below are derived from the supplied filenames, rather than verified tags.

| Asset | Title label | Creator handle | Duration | Original filename |
| --- | --- | --- | --- | --- |
| `firelit-tavern.mp3` | Fantasy Worlds – Firelit Tavern | `vadim_makes_sound` | 2:14.880 | `vadim_makes_sound-fantasy-worlds-firelit-tavern-569484.mp3` |
| `medieval.mp3` | Medieval (Medieval Music) | `sigmamusicart` | 1:51.282 | `sigmamusicart-medieval-medieval-music-152847.mp3` |
| `city-tavern-ambient.mp3` | Medieval City/Tavern Ambient | `deuslower` | 2:43.004 | `deuslower-medieval-citytavern-ambient-235876.mp3` |
| `funny-medieval.mp3` | Funny Medieval Instrumental | `vifotofreesounds` | 1:52.248 | `vifotofreesounds-funny-medieval-instrumental-486733.mp3` |
| `peaceful-medieval.mp3` | Medieval Music | `kiravale` | 3:03.624 | `kiravale-medieval-music-593694.mp3` |

All files are stereo MP3 at 256 kb/s. Firelit Tavern and Medieval Music use 48 kHz; the others use
44.1 kHz. ffprobe estimates durations from bitrate; browser decoding may report
slightly different durations.

## Playback preparation

Measured with ffmpeg `loudnorm` and `silencedetect` on the original files.
Playback gains target -20 LUFS before the shared music volume control and global
mix gain apply. They preserve each recording's dynamics without transcoding.

| Asset | Integrated LUFS | True peak dBTP | Playback gain | Start (s) | End (s) |
| --- | ---: | ---: | ---: | ---: | ---: |
| `firelit-tavern.mp3` | -13.64 | -3.44 | 0.481 | 0.54 | 134.88 |
| `medieval.mp3` | -16.76 | -3.90 | 0.689 | 0.45 | 110.97 |
| `city-tavern-ambient.mp3` | -22.86 | -4.76 | 1.390 | 6.95 | 161.97 |
| `funny-medieval.mp3` | -12.72 | -1.11 | 0.433 | 0.14 | 112.248 |
| `peaceful-medieval.mp3` | -9.75 | +0.25 | 0.307 | 0.00 | 182.80 |

The candidate ranges preserve quiet fades while skipping the leading/trailing
silence detected at -60 dB. Firelit Tavern and Funny Medieval have no trailing
silence of at least 0.1 seconds at that threshold. These are playback ranges, not
musically seamless loop points. Playback uses a 2.5 second crossfade when repeating
or switching tracks, clamping the end to the browser's decoded duration.

Medieval Music plays in the starting plains, forest and lake. Firelit Tavern stays
on the introduction and in the tavern; the intense and indoor biomes retain their
own recordings. The peaceful track continues across peaceful biome boundaries.
