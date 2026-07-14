import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { createGroup, getGroups } from '../lib/api';
import type { Group } from '../types';

export function GroupsPage() {
  const { user, logout } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [smsNumbers, setSmsNumbers] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;

    getGroups()
      .then((payload) => setGroups(payload))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Failed to load groups.'))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  async function onCreateGroup(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setCreating(true);

    try {
      const created = await createGroup({
        name: groupName.trim(),
        description: groupDescription.trim() || undefined,
        smsPhoneNumbers: smsNumbers
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      });

      setGroups((current) => [created, ...current]);
      setGroupName('');
      setGroupDescription('');
      setSmsNumbers('');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create group.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="layout">
      <header className="topbar">
        <div>
          <h1>PulseChat Groups</h1>
          <p className="muted">Signed in as {user.phoneNumber}</p>
        </div>
        <button className="ghost" onClick={logout}>Log out</button>
      </header>

      <section className="card">
        <h2>Create Group</h2>
        <form onSubmit={onCreateGroup} className="stack">
          <label>
            Group name
            <input value={groupName} onChange={(e) => setGroupName(e.target.value)} required />
          </label>
          <label>
            Description
            <input value={groupDescription} onChange={(e) => setGroupDescription(e.target.value)} />
          </label>
          <label>
            SMS numbers (comma separated)
            <input value={smsNumbers} onChange={(e) => setSmsNumbers(e.target.value)} placeholder="+13155550111,+13155550112" />
          </label>
          <button type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create Group'}</button>
        </form>
      </section>

      <section className="card">
        <h2>Your Groups</h2>
        {loading && <p>Loading groups...</p>}
        {error && <p className="error">{error}</p>}
        {!loading && groups.length === 0 && <p className="muted">No groups yet.</p>}
        <ul className="list">
          {groups.map((group) => (
            <li key={group.id}>
              <Link to={`/groups/${group.id}`}>
                <strong>{group.name}</strong>
                <span className="muted">{group.description || 'No description'}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
