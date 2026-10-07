import { Pressable, ScrollView, StyleSheet, Text } from 'react-native'

import { CATEGORIES, type Category } from '../menu'

type Props = { selected: Category; onSelect: (category: Category) => void }

export function CategoryChips({ selected, onSelect }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {CATEGORIES.map(category => (
        <Pressable
          key={category}
          onPress={() => onSelect(category)}
          style={[styles.chip, category !== selected && styles.selected]}
        >
          <Text style={[styles.label, category !== selected && styles.selectedLabel]}>{category}</Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingHorizontal: 20 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: '#efe4d6' },
  selected: { backgroundColor: '#3b2a20' },
  label: { fontSize: 14, fontWeight: '600', color: '#3b2a20' },
  selectedLabel: { color: '#f6efe6' },
})
