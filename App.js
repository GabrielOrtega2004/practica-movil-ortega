import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import initSqlJs from 'sql.js';

const STORAGE_KEY = 'mis-tareas-db';

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export default function App() {
  const dbRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [sqliteVersion, setSqliteVersion] = useState('');
  const [tasks, setTasks] = useState([]);
  const [newTaskText, setNewTaskText] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const SQL = await initSqlJs({
          locateFile: (file) => `/${file}`,
        });

        const saved = localStorage.getItem(STORAGE_KEY);
        const db = saved ? new SQL.Database(base64ToBytes(saved)) : new SQL.Database();

        if (!saved) {
          db.run(
            'CREATE TABLE tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0);'
          );
        }

        if (cancelled) return;
        dbRef.current = db;
        setSqliteVersion(db.exec('SELECT sqlite_version();')[0].values[0][0]);
        refreshTasks();
        setReady(true);
      } catch (err) {
        if (!cancelled) setError(err && err.message ? err.message : String(err));
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  function persist() {
    const bytes = dbRef.current.export();
    localStorage.setItem(STORAGE_KEY, bytesToBase64(bytes));
  }

  function refreshTasks() {
    const result = dbRef.current.exec('SELECT id, title, done FROM tasks ORDER BY id DESC;');
    const rows = result.length
      ? result[0].values.map(([id, title, done]) => ({ id, title, done: !!done }))
      : [];
    setTasks(rows);
  }

  function addTask() {
    const title = newTaskText.trim();
    if (!title) return;
    dbRef.current.run('INSERT INTO tasks (title, done) VALUES (?, 0);', [title]);
    setNewTaskText('');
    refreshTasks();
    persist();
  }

  function toggleTask(id, done) {
    dbRef.current.run('UPDATE tasks SET done = ? WHERE id = ?;', [done ? 0 : 1, id]);
    refreshTasks();
    persist();
  }

  function deleteTask(id) {
    dbRef.current.run('DELETE FROM tasks WHERE id = ?;', [id]);
    refreshTasks();
    persist();
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Error al iniciar SQLite</Text>
        <Text selectable style={{ marginTop: 12 }}>{error}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.container}>
        <Text>Cargando base de datos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mis Tareas</Text>
      <Text style={styles.subtitle}>SQLite v{sqliteVersion}</Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Nueva tarea"
          value={newTaskText}
          onChangeText={setNewTaskText}
          onSubmitEditing={addTask}
        />
        <Pressable style={styles.addButton} onPress={addTask}>
          <Text style={styles.addButtonText}>Agregar</Text>
        </Pressable>
      </View>

      <FlatList
        style={styles.list}
        data={tasks}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.taskRow}>
            <Pressable style={styles.taskTextWrap} onPress={() => toggleTask(item.id, item.done)}>
              <Text style={[styles.taskText, item.done && styles.taskTextDone]}>
                {item.done ? '✅ ' : '⬜ '}
                {item.title}
              </Text>
            </Pressable>
            <Pressable onPress={() => deleteTask(item.id)}>
              <Text style={styles.deleteButton}>🗑</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No hay tareas todavía.</Text>}
      />

      <StatusBar style="auto" />
    </View>
  );
}

const PRIMARY_COLOR = '#2563EB';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  addButton: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  list: {
    flex: 1,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  taskTextWrap: {
    flex: 1,
  },
  taskText: {
    fontSize: 16,
  },
  taskTextDone: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  deleteButton: {
    fontSize: 18,
    marginLeft: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
  },
});
