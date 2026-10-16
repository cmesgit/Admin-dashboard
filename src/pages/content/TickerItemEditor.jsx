import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { createTickerItem, getTickerItem, updateTickerItem } from "../../api/admin_content_studio";
import UnsavedChangesDialog from "../../components/UnsavedChangesDialog";
import { useUnsavedChangesGuard } from "../../hooks/useUnsavedChangesGuard";
import { errText } from "../../utils/errText";
import TickerItemForm from "./TickerItemForm";
import "../../css/ContentStudio.css";
import "../../css/TickerItemEditor.css";

function Editor({ id }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queueUrl = `/content/ticker${location.search}`;
  const [loaded, setLoaded] = useState({ loading: Boolean(id), item: null, error: "" });
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const formRef = useRef(null);
  const guard = useUnsavedChangesGuard(dirty, { busy, onSave: () => formRef.current?.save(false) ?? false });

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    getTickerItem(id, { signal: controller.signal })
      .then((item) => {
        if (!controller.signal.aborted) setLoaded({ loading: false, item, error: "" });
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setLoaded({ loading: false, item: null, error: e.response?.status === 404
          ? "This advertisement could not be found. It may have been removed."
          : errText(e) });
      });
    return () => controller.abort();
  }, [id, attempt]);

  const cancel = () => guard.guardedNavigate(navigate, queueUrl);
  const save = async (payload, file, leaveForQueue = true) => {
    if (busy) return false;
    setBusy(true);
    setError("");
    try {
      if (id) await updateTickerItem(id, payload, file);
      else await createTickerItem(payload, file);
      setDirty(false);
      if (leaveForQueue) guard.navigateAfterSave(navigate, queueUrl, {
        replace: true,
        state: { tickerNotice: id ? "Saved." : "Saved as a draft. Turn on the advertisement’s switch when you are ready." },
      });
      return true;
    } catch (e) {
      setError(errText(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dashboard-wrapper ticker-item-editor">
      <header className="cs-home__head">
        <div>
          <h1 className="dashboard-title">{id ? "Edit advertisement" : "New advertisement"}</h1>
          <p className="cs-home__sub">Choose its picture, where it appears and its display dates.</p>
        </div>
        <button type="button" className="cs-btn-ghost" onClick={cancel} disabled={busy}>
          <ArrowLeft size={15} aria-hidden="true" /> Back to advertisements
        </button>
      </header>

      {loaded.loading && <p className="cs-muted" role="status">Loading advertisement…</p>}
      {loaded.error && (
        <div className="cs-card">
          <p className="cs-error" role="alert">{loaded.error}</p>
          <button type="button" className="cs-btn-ghost" onClick={() => {
            setLoaded({ loading: true, item: null, error: "" });
            setAttempt((value) => value + 1);
          }}>Try again</button>
        </div>
      )}
      {!loaded.loading && !loaded.error && (
        <TickerItemForm
          submitRef={formRef}
          initial={loaded.item}
          busy={busy}
          error={error}
          onSubmit={save}
          onCancel={cancel}
          onDirtyChange={setDirty}
        />
      )}
      <UnsavedChangesDialog guard={guard} />
    </div>
  );
}

// A different item (including New) gets fresh fields, file state and load state.
export default function TickerItemEditor() {
  const { id } = useParams();
  return <Editor key={id || "new"} id={id} />;
}
