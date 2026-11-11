import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet, SafeAreaView,
  TextInput, Platform, StatusBar as RNStatusBar, Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as MediaLibrary from 'expo-media-library';
import * as DocumentPicker from 'expo-document-picker';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';

const C = {
  bg: '#1B2540', surface: '#26335A', raised: '#31416F',
  text: '#F4EFE6', muted: '#9AA6C8', accent: '#F2A65A',
};

const fmt = (s = 0) => {
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${m}:${r < 10 ? '0' : ''}${r}`;
};

export default function App() {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [tracks, setTracks] = useState([]);
  const [index, setIndex] = useState(-1);
  const [query, setQuery] = useState('');
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [barW, setBarW] = useState(1);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true }).catch(() => {});
  }, []);

  const playIndex = useCallback((i) => {
    if (i < 0 || i >= tracks.length) return;
    setIndex(i);
    player.replace({ uri: tracks[i].uri });
    player.play();
  }, [tracks, player]);

  const next = useCallback(() => {
    if (!tracks.length) return;
    if (shuffle) return playIndex(Math.floor(Math.random() * tracks.length));
    playIndex((index + 1) % tracks.length);
  }, [tracks, index, shuffle, playIndex]);

  const prev = () => {
    if (status.currentTime > 3) return player.seekTo(0);
    playIndex(index <= 0 ? tracks.length - 1 : index - 1);
  };

  useEffect(() => {
    if (status.didJustFinish) {
      if (repeat) { player.seekTo(0); player.play(); } else next();
    }
  }, [status.didJustFinish]);

  const scanPhone = async () => {
    const perm = await MediaLibrary.requestPermissionsAsync(false, ['audio']);
    if (!perm.granted) {
      return Alert.alert('Permission needed', 'Allow access to music and audio so songs on your phone can be listed.');
    }
    let all = [], after;
    for (;;) {
      const page = await MediaLibrary.getAssetsAsync({ mediaType: 'audio', first: 200, after, sortBy: 'modificationTime' });
      all = all.concat(page.assets);
      if (!page.hasNextPage) break;
      after = page.endCursor;
    }
    const list = all.filter(a => a.duration > 30).map(a => ({
      id: a.id, uri: a.uri, title: a.filename.replace(/\.[^.]+$/, ''), duration: a.duration,
    }));
    if (!list.length) Alert.alert('No songs found', 'Try "Add files" to pick songs manually.');
    setTracks(list);
  };

  const addFiles = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: 'audio/*', multiple: true, copyToCacheDirectory: true });
    if (res.canceled) return;
    const added = res.assets.map(a => ({
      id: a.uri, uri: a.uri, title: a.name.replace(/\.[^.]+$/, ''), duration: 0,
    }));
    setTracks(t => [...t, ...added]);
  };

  const visible = tracks
    .map((t, i) => ({ ...t, i }))
    .filter(t => t.title.toLowerCase().includes(query.toLowerCase()));
  const current = tracks[index];
  const progress = status.duration ? status.currentTime / status.duration : 0;

  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="light" />
      <View style={s.header}>
        <Text style={s.title}>Tune Deck</Text>
        <View style={s.row}>
          <Pressable style={s.chip} onPress={scanPhone}><Text style={s.chipText}>Scan phone</Text></Pressable>
          <Pressable style={s.chip} onPress={addFiles}><Text style={s.chipText}>Add files</Text></Pressable>
        </View>
      </View>

      <TextInput
        style={s.search} placeholder="Search songs" placeholderTextColor={C.muted}
        value={query} onChangeText={setQuery}
      />

      <FlatList
        data={visible}
        keyExtractor={t => t.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          <Text style={s.empty}>
            {tracks.length ? 'No songs match your search.' : 'No songs yet. Tap "Scan phone" to list the music on your phone, or "Add files" to pick songs.'}
          </Text>
        }
        renderItem={({ item }) => {
          const active = item.i === index;
          return (
            <Pressable style={[s.item, active && s.itemActive]} onPress={() => playIndex(item.i)}>
              <View style={[s.dot, active && { backgroundColor: C.accent }]} />
              <Text numberOfLines={1} style={[s.itemText, active && { color: C.accent }]}>{item.title}</Text>
              {!!item.duration && <Text style={s.time}>{fmt(item.duration)}</Text>}
            </Pressable>
          );
        }}
      />

      <View style={s.player}>
        <Text numberOfLines={1} style={s.now}>{current ? current.title : 'Pick a song to start'}</Text>
        <Pressable
          style={s.bar} onLayout={e => setBarW(e.nativeEvent.layout.width)}
          onPress={e => current && status.duration && player.seekTo((e.nativeEvent.locationX / barW) * status.duration)}
        >
          <View style={[s.fill, { width: `${progress * 100}%` }]} />
        </Pressable>
        <View style={s.timesRow}>
          <Text style={s.time}>{fmt(status.currentTime)}</Text>
          <Text style={s.time}>{fmt(status.duration)}</Text>
        </View>
        <View style={s.controls}>
          <Pressable onPress={() => setShuffle(v => !v)}><Text style={[s.ctl, shuffle && s.on]}>Shuffle</Text></Pressable>
          <Pressable onPress={prev}><Text style={s.ctlBig}>Prev</Text></Pressable>
          <Pressable style={s.play} onPress={() => current && (status.playing ? player.pause() : player.play())}>
            <Text style={s.playText}>{status.playing ? 'Pause' : 'Play'}</Text>
          </Pressable>
          <Pressable onPress={next}><Text style={s.ctlBig}>Next</Text></Pressable>
          <Pressable onPress={() => setRepeat(v => !v)}><Text style={[s.ctl, repeat && s.on]}>Repeat</Text></Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0 },
  header: { padding: 20, paddingBottom: 8 },
  title: { color: C.text, fontSize: 30, fontWeight: '800', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 10 },
  chip: { backgroundColor: C.raised, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  chipText: { color: C.text, fontWeight: '600' },
  search: { backgroundColor: C.surface, color: C.text, marginHorizontal: 20, marginVertical: 10, padding: 12, borderRadius: 12 },
  empty: { color: C.muted, textAlign: 'center', padding: 32, lineHeight: 22 },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  itemActive: { backgroundColor: C.surface },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.raised },
  itemText: { flex: 1, color: C.text, fontSize: 16 },
  time: { color: C.muted, fontSize: 12 },
  player: { backgroundColor: C.surface, padding: 20, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  now: { color: C.text, fontSize: 18, fontWeight: '700', marginBottom: 14 },
  bar: { height: 8, backgroundColor: C.raised, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: C.accent },
  timesRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  ctl: { color: C.muted, fontSize: 13 },
  on: { color: C.accent, fontWeight: '700' },
  ctlBig: { color: C.text, fontSize: 16, fontWeight: '600' },
  play: { backgroundColor: C.accent, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 30 },
  playText: { color: C.bg, fontWeight: '800', fontSize: 16 },
});
