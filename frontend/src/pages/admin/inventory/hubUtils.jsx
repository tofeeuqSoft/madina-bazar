import { useEffect, useRef, Component, cloneElement } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, btnPrimary } from './widgets';
import useAuthStore from '../../../store/authStore';
import { can } from '../../../utils/permissions';

// One broken tab must never blank the whole hub.
export class TabBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidUpdate(prevProps) { if (prevProps.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  render() {
    if (this.state.error) {
      return (
        <Card>
          <p className="text-sm text-red-600 font-semibold">This tab failed to load — other tabs are unaffected.</p>
          <p className="text-xs text-gray-500 mt-1">{String(this.state.error?.message || this.state.error)}</p>
          <button onClick={() => this.setState({ error: null })} className={btnPrimary}>Retry</button>
        </Card>
      );
    }
    return this.props.children;
  }
}

// Form components opt in: useTabDirty(onDirty, <true when form has unsent input>).
// HubShell then warns before tab switch destroys the draft.
export function useTabDirty(onDirty, isDirty) {
  useEffect(() => { onDirty?.(!!isDirty); }, [isDirty]);
}

// Generic hub: perm-filtered tabs (?tab= sync), draft guard, per-tab boundary.
// tabs: [{ key, label, to, perm: [...], element }]. Route-level RequirePerm stays
// in App.jsx — this only hides tabs the user may not open anyway.
export function HubShell({ tabs, param = 'tab' }) {
  const { user } = useAuthStore();
  const [params] = useSearchParams();
  const visible = tabs.filter((t) => !t.perm || can(user, ...t.perm));
  const want = params.get(param);
  const active = visible.some((t) => t.key === want) ? want : visible[0]?.key;
  const dirtyRef = useRef(false);
  const guard = (e) => {
    if (dirtyRef.current && !window.confirm('Unsaved form data will be lost. Switch tab?')) e.preventDefault();
    else dirtyRef.current = false;
  };
  if (!visible.length) return null;
  const tab = visible.find((t) => t.key === active);
  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {visible.map((t) => (
          <Link
            key={t.key}
            to={t.to}
            onClick={guard}
            className={t.key === active ? btnPrimary : `${btnPrimary} opacity-60`}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <TabBoundary resetKey={active}>
        {cloneElement(tab.element, { onDirty: (v) => { dirtyRef.current = v; } })}
      </TabBoundary>
    </div>
  );
}
