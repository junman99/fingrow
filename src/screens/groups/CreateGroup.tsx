import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Alert, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenScroll } from '../../components/ScreenScroll';
import { AppHeader } from '../../components/AppHeader';
import Button from '../../components/Button';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useNavigation } from '@react-navigation/native';
import { useGroupsStore } from '../../store/groups';

type Row = { name: string; contact?: string };

const KEY_INCLUDE_ME = 'fingrow/ui/createGroup/includeMeDefault';

export default function CreateGroup() {
  const { get } = useThemeTokens();
  const nav = useNavigation<any>();
  const { createGroup } = useGroupsStore();
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [includeMe, setIncludeMe] = useState(true);
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY_INCLUDE_ME).then(v => {
      if (v === 'true') setIncludeMe(true);
      if (v === 'false') setIncludeMe(false);
    });
  }, []);

  useEffect(() => {
    setRows(r => {
      const hasMe = r.some(x => x.name === 'Me');
      if (includeMe && !hasMe) return [{ name: 'Me', contact: '' }, ...r];
      if (!includeMe && hasMe) return r.filter(x => x.name !== 'Me');
      return r.length ? r : [{ name: '', contact: '' }];
    });
  }, [includeMe]);

  const addRow = () => setRows(r => [...r, { name: '', contact: '' }]);
  const updateRow = (i: number, patch: Partial<Row>) => setRows(r => r.map((row, idx) => idx === i ? { ...row, ...patch } : row));
  const removeRow = (i: number) => setRows(r => r.filter((_, idx) => idx !== i));

  const onSave = async () => {
    if (!name.trim()) { Alert.alert('Enter a group name'); return; }
    if (remember) await AsyncStorage.setItem(KEY_INCLUDE_ME, includeMe ? 'true' : 'false');
    const members = rows
      .map(r => ({ name: r.name.trim(), contact: r.contact?.trim() || undefined }))
      .filter(r => r.name.length > 0);
    const id = await createGroup({ name: name.trim(), note: note.trim() || undefined, members });
    nav.replace('GroupDetail', { groupId: id });
  };

  return (
    <ScreenScroll>
      <AppHeader title="Create Group" />
      <View style={{ padding: spacing.s16, gap: spacing.s16 }}>
        <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>Details</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Group name" placeholderTextColor={get('text.muted') as string}
          style={{ borderWidth:1, borderColor:get('border.subtle') as string, borderRadius: radius.md, padding: spacing.s12, color:get('text.primary') as string, backgroundColor:get('surface.level1') as string }} />
        <TextInput value={note} onChangeText={setNote} placeholder="Note (optional)" placeholderTextColor={get('text.muted') as string} multiline
          style={{ borderWidth:1, borderColor:get('border.subtle') as string, borderRadius: radius.md, padding: spacing.s12, color:get('text.primary') as string, backgroundColor:get('surface.level1') as string }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: get('text.primary') as string }}>Include me</Text>
          <Switch value={includeMe} onValueChange={setIncludeMe} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: get('text.muted') as string }}>Remember this choice</Text>
          <Switch value={remember} onValueChange={setRemember} />
        </View>

        <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>Members</Text>
        {rows.map((row, i) => (
          <View key={i} style={{ gap: spacing.s8 }}>
            <TextInput value={row.name} onChangeText={(t)=>updateRow(i,{name:t})} placeholder="Name" placeholderTextColor={get('text.muted') as string}
              style={{ borderWidth:1, borderColor:get('border.subtle') as string, borderRadius: radius.md, padding: spacing.s12, color:get('text.primary') as string, backgroundColor:get('surface.level1') as string }} />
            <TextInput value={row.contact} onChangeText={(t)=>updateRow(i,{contact:t})} placeholder="Contact (optional)" placeholderTextColor={get('text.muted') as string}
              style={{ borderWidth:1, borderColor:get('border.subtle') as string, borderRadius: radius.md, padding: spacing.s12, color:get('text.primary') as string, backgroundColor:get('surface.level1') as string }} />
            {rows.length > 1 ? <Button variant="ghost" title="Remove" onPress={()=>removeRow(i)} /> : null}
          </View>
        ))}
        <Button variant="secondary" title="+ Add member" onPress={addRow} />
        <Button title="Create" onPress={onSave} />
      </View>
    </ScreenScroll>
  );
}
