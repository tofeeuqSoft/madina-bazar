import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ExternalLink } from 'lucide-react';
import MediaUploader from '../../../components/admin/MediaUploader';
import { PRESET_COLORS } from '../../../utils/colorPalette';
import inventoryApi from '../../../services/inventory';
import api from '../../../services/api';
import useAuthStore from '../../../store/authStore';
import { can } from '../../../utils/permissions';
import { Card, PageHead, Badge, Empty, inputCls, btnPrimary, btnGhost, btnDanger } from './widgets';

const CSV_TEMPLATE = 'name,sku,category,regularPrice,salePrice,costPrice,stock,minStock,unit,size,color,vatExempt,isActive,images,mainImage,videos\nPremium Rice 5kg,RICE-5KG,Grocery,850,820,700,100,10,Packet,,,false,true,https://res.cloudinary.com/demo/image/upload/rice.jpg|https://res.cloudinary.com/demo/image/upload/rice2.jpg,1,https://res.cloudinary.com/demo/video/upload/rice.mp4';

export default function ProductsInventory() {
  const { user } = useAuthStore();
  const canMaintain = can(user, 'product.import', 'product.bulk_edit');
  const [tab, setTab] = useState('table');
  const tabs = canMaintain
    ? [['table', 'Category Table'], ['upload', 'CSV Upload'], ['batches', 'Import Batches']]
    : [['table', 'Category Table']];
  return (
    <div>
      <PageHead title="Products Inventory" sub="পুরো product maintenance-এর root — দেখা • edit • আনা • ফেরত, এক ঠিকানায়" />
      <div className="flex gap-2 mb-4 flex-wrap">
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={tab === k ? btnPrimary : btnGhost}>{l}</button>
        ))}
      </div>
      {tab === 'table' && <CatalogTable canMaintain={canMaintain} />}
      {tab === 'upload' && canMaintain && <CsvUpload />}
      {tab === 'batches' && canMaintain && <Batches />}
    </div>
  );
}

function CatalogTable({ canMaintain = false }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [cats, setCats] = useState([]);
  const [cat, setCat] = useState('');
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState([]);
  const [editId, setEditId] = useState(null);
  const [edit, setEdit] = useState({});
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    const r = await inventoryApi.catalog({ category: cat || undefined, search: search || undefined, limit: 30 }).catch(() => ({ data: [], total: 0 }));
    setRows(r.data || []);
    setTotal(r.total || 0);
    setSel([]);
  };
  useEffect(() => {
    api.get('/categories').then((r) => setCats(r.data?.data || [])).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [cat]);
  useEffect(() => {
    const t = setTimeout(() => { if (search !== '') load(); }, 500);
    return () => clearTimeout(t);
  }, [search]);

  const startEdit = (p) => {
    setEditId(p._id);
    setEdit({ regularPrice: p.regularPrice, salePrice: p.salePrice, costPrice: p.costPrice, minStock: p.minStock, stock: p.stockLive?.onHand ?? p.stock, vatExempt: p.vatExempt, isActive: p.isActive });
  };
  const saveEdit = async (force = false) => {
    try {
      await inventoryApi.patchCatalog(editId, { patch: edit, force });
      toast.success('Saved');
      setEditId(null);
      load();
    } catch (e) {
      if (e.response?.data?.code === 'PRICE_GUARD' && confirm(`${e.response.data.message}\n\nApply anyway?`)) {
        try {
          await inventoryApi.patchCatalog(editId, { patch: edit, force: true });
          toast.success('Saved with override');
          setEditId(null);
          load();
        } catch (e2) { toast.error(e2.response?.data?.message || e2.message); }
      } else if (e.response?.data?.code !== 'PRICE_GUARD') toast.error(e.response?.data?.message || e.message);
    }
  };
  const bulk = async (op, value) => {
    if (!sel.length) return toast.error('Select products first');
    if (!confirm(`${sel.length} products — ${op}?`)) return;
    try {
      const res = await inventoryApi.catalogBulk({ ids: sel, op, value, force: true });
      const failed = res.filter((r) => !r.ok);
      toast.success(`Done. Failed: ${failed.length}`);
      load();
    } catch (e) { toast.error(e.response?.data?.message || e.message); }
  };

  return (
    <>
      <Card className="mb-4">
        <div className="flex flex-wrap gap-2 items-center">
          <select className={inputCls} style={{ maxWidth: 220 }} value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">All categories</option>
            {cats.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <input className={inputCls} style={{ maxWidth: 260 }} placeholder="Search name / SKU…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <span className="text-xs text-gray-500">{total} products • {sel.length} selected</span>
          {canMaintain && <button onClick={() => setShowAdd(true)} className={btnPrimary}>＋ Add Product</button>}
        </div>
        {canMaintain && sel.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={() => bulk('setActive', true)} className={btnGhost}>Activate</button>
            <button onClick={() => bulk('setActive', false)} className={btnGhost}>Deactivate</button>
            <button onClick={() => { const v = prompt('Price change % (e.g. 10 or -5):'); if (v !== null) bulk('pricePct', Number(v)); }} className={btnGhost}>Price ±%</button>
            <button onClick={() => { const v = prompt('Min stock:'); if (v !== null) bulk('setMinStock', Number(v)); }} className={btnGhost}>Min stock</button>
          </div>
        )}
      </Card>
      {showAdd && <AddProductModal cats={cats} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
      <Card>
        {rows.length === 0 ? <Empty /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1000px]">
              <thead><tr className="text-left text-gray-500">{canMaintain && <th className="p-2"><input type="checkbox" checked={sel.length === rows.length && rows.length > 0} onChange={(e) => setSel(e.target.checked ? rows.map((r) => r._id) : [])} /></th>}<th className="p-2">Product</th><th className="p-2">Price</th><th className="p-2">Cost</th><th className="p-2">Stock (on-hand)</th><th className="p-2">Active</th><th className="p-2">Store</th>{canMaintain && <th className="p-2">Action</th>}</tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p._id} className="border-t border-black/5">
                    {canMaintain && <td className="p-2"><input type="checkbox" checked={sel.includes(p._id)} onChange={(e) => setSel(e.target.checked ? [...sel, p._id] : sel.filter((x) => x !== p._id))} /></td>}
                    <td className="p-2"><b>{p.name}</b><p className="text-[10px] text-gray-400">{p.sku} • {p.category?.name}</p></td>
                    <td className="p-2">
                      {canMaintain && editId === p._id ? <input className={inputCls} style={{ width: 90 }} type="number" value={edit.salePrice} onChange={(e) => setEdit({ ...edit, salePrice: e.target.value })} /> : `৳${p.salePrice}`}
                    </td>
                    <td className="p-2 text-xs">৳{p.costPrice}</td>
                    <td className="p-2">
                      {canMaintain && editId === p._id
                        ? <input className={inputCls} style={{ width: 80 }} type="number" min="0" value={edit.stock} onChange={(e) => setEdit({ ...edit, stock: e.target.value })} />
                        : <>{p.stockLive?.onHand ?? p.stock} <span className="text-[10px] text-gray-400">({p.stockLive?.available ?? p.stock} avail)</span></>}
                    </td>
                    <td className="p-2"><Badge value={p.isActive ? 'ACTIVE' : 'INACTIVE'} /></td>
                    <td className="p-2"><a href={p.storeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary-700 hover:underline"><ExternalLink className="w-3.5 h-3.5" />View</a></td>
                    {canMaintain && (
                    <td className="p-2">
                      {editId === p._id ? (
                        <span className="flex gap-1">
                          <button onClick={() => saveEdit()} className={btnPrimary}>Save</button>
                          <button onClick={() => setEditId(null)} className={btnGhost}>×</button>
                        </span>
                      ) : <button onClick={() => startEdit(p)} className={btnGhost}>Edit</button>}
                    </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

const UNITS = ['Piece', 'KG', 'Gram', 'Liter', 'ML', 'Packet', 'Box', 'Dozen'];

function AddProductModal({ cats, onClose, onSaved }) {
  const [scope, setScope] = useState('Nationwide');
  const [subcats, setSubcats] = useState([]);
  const [f, setF] = useState({ name: '', category: '', subcategory: '', brand: '', sku: '', regularPrice: '', salePrice: '', costPrice: '', stock: '', minStock: 5, unit: 'Piece', sizes: '', colors: [], description: '', images: [], videos: [], vatExempt: false, isActive: true, isFeatured: false });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!f.category) { setSubcats([]); return; }
    api.get('/categories', { params: { parent: f.category } }).then((r) => setSubcats(r.data?.data || [])).catch(() => setSubcats([]));
  }, [f.category]);

  const save = async (e) => {
    e.preventDefault();
    if (!f.name.trim() || !f.category || f.regularPrice === '') return toast.error('Name, category, price required');
    setSaving(true);
    try {
      await inventoryApi.catalogCreate({
        ...f,
        isGrocery: scope === 'Grocery',
        regularPrice: Number(f.regularPrice),
        salePrice: f.salePrice === '' ? undefined : Number(f.salePrice),
        subcategory: f.subcategory || undefined,
        colors: (f.colors || []).filter((c) => c.name?.trim()),
      });
      toast.success('Product added');
      onSaved();
    } catch (err) { toast.error(err.response?.data?.message || err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-[#12241a] rounded-2xl p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-4">
        <h3 className="font-bold">Add Product</h3>
        <div>
          <label className="block text-sm font-medium mb-2">Delivery Scope *</label>
          <div className="grid grid-cols-2 gap-3">
            {[{ v: 'Nationwide', icon: '🌍', desc: 'All Bangladesh delivery' }, { v: 'Grocery', icon: '🥛', desc: 'Grocery zones only' }].map((o) => (
              <button key={o.v} type="button" onClick={() => setScope(o.v)} className={`rounded-xl border-2 p-3 text-left transition ${scope === o.v ? 'border-primary-700 dark:border-gold-400 bg-primary-50 dark:bg-gold-400/10' : 'border-[#e5e2da] dark:border-[#2a3b30]'}`}>
                <span className="text-xl">{o.icon}</span>
                <span className="block font-semibold text-sm mt-1">{o.v}</span>
                <span className="block text-[11px] text-gray-500">{o.desc}</span>
              </button>
            ))}
          </div>
        </div>
        <input className={inputCls} placeholder="Product name *" value={f.name} onChange={(e) => set('name', e.target.value)} required />
        <div className="grid sm:grid-cols-2 gap-3">
          <select className={inputCls} value={f.category} onChange={(e) => setF((p) => ({ ...p, category: e.target.value, subcategory: '' }))} required>
            <option value="">Category *</option>
            {cats.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <select className={inputCls} value={f.subcategory} onChange={(e) => set('subcategory', e.target.value)}>
            <option value="">Subcategory (none)</option>
            {subcats.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <select className={inputCls} value={f.unit} onChange={(e) => set('unit', e.target.value)}>
            {UNITS.map((u) => <option key={u}>{u}</option>)}
          </select>
          <input className={inputCls} placeholder="Brand" value={f.brand} onChange={(e) => set('brand', e.target.value)} />
          <input className={inputCls} placeholder="SKU (auto if empty)" value={f.sku} onChange={(e) => set('sku', e.target.value)} />
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <input className={inputCls} type="number" min="0" step="0.01" placeholder="Regular price *" value={f.regularPrice} onChange={(e) => set('regularPrice', e.target.value)} required />
          <input className={inputCls} type="number" min="0" step="0.01" placeholder="Sale price" value={f.salePrice} onChange={(e) => set('salePrice', e.target.value)} />
          <input className={inputCls} type="number" min="0" step="0.01" placeholder="Cost price" value={f.costPrice} onChange={(e) => set('costPrice', e.target.value)} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <input className={inputCls} type="number" min="0" placeholder="Stock" value={f.stock} onChange={(e) => set('stock', e.target.value)} />
          <input className={inputCls} type="number" min="0" placeholder="Min stock (alert)" value={f.minStock} onChange={(e) => set('minStock', e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Available Sizes (comma separated)</label>
          <input className={inputCls} value={f.sizes} onChange={(e) => set('sizes', e.target.value)} placeholder="e.g. S, M, L, XL" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Available Colors</label>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {PRESET_COLORS.map((preset) => {
              const added = (f.colors || []).some((c) => c.name?.toLowerCase() === preset.name.toLowerCase());
              return (
                <button
                  key={preset.name}
                  type="button"
                  title={added ? `${preset.name} (added)` : `Add ${preset.name}`}
                  onClick={() => { if (added) return; setF((p) => ({ ...p, colors: [...(p.colors || []), { ...preset }] })); }}
                  className={`w-8 h-8 rounded-full border-2 transition ${added ? 'border-green-600 opacity-40 cursor-default' : 'border-gray-300 hover:scale-110'}`}
                  style={{ backgroundColor: preset.code }}
                />
              );
            })}
          </div>
          <div className="space-y-2">
            {(f.colors || []).map((c, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  className={`${inputCls} flex-1`}
                  placeholder="Color name (e.g. Red)"
                  value={c.name}
                  onChange={(e) => { const colors = [...f.colors]; colors[i] = { ...colors[i], name: e.target.value }; set('colors', colors); }}
                />
                <input
                  type="color"
                  className="w-10 h-10 rounded border cursor-pointer bg-white"
                  value={/^#[0-9a-fA-F]{6}$/.test(c.code) ? c.code : '#d9a857'}
                  onChange={(e) => { const colors = [...f.colors]; colors[i] = { ...colors[i], code: e.target.value }; set('colors', colors); }}
                  title="Swatch color"
                />
                <button type="button" onClick={() => set('colors', f.colors.filter((_, j) => j !== i))} className={btnGhost}>✕</button>
              </div>
            ))}
            <button type="button" onClick={() => set('colors', [...(f.colors || []), { name: '', code: '#d9a857' }])} className={btnGhost}>+ Add Color</button>
          </div>
        </div>
        <textarea className={inputCls} rows={2} placeholder="Description" value={f.description} onChange={(e) => set('description', e.target.value)} />
        <MediaUploader
          images={f.images}
          videos={f.videos}
          onImagesChange={(images) => set('images', images)}
          onVideosChange={(videos) => set('videos', videos)}
        />
        <div>
          <label className="block text-sm font-medium mb-1">Or paste image URLs (one per line)</label>
          <textarea
            className={`${inputCls} font-mono text-sm`}
            rows={2}
            value={(f.images || []).join('\n')}
            onChange={(e) => set('images', e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
            placeholder="https://..."
          />
        </div>
        <div className="flex gap-5 flex-wrap">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isActive} onChange={(e) => set('isActive', e.target.checked)} /> Active</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isFeatured} onChange={(e) => set('isFeatured', e.target.checked)} /> Featured</label>
          <label className="flex items-center gap-2 text-sm" title="VAT-free product"><input type="checkbox" checked={f.vatExempt} onChange={(e) => set('vatExempt', e.target.checked)} /> VAT Exempt</label>
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button disabled={saving} className={btnPrimary}>{saving ? 'Saving…' : 'Add Product'}</button>
        </div>
      </form>
    </div>
  );
}

function CsvUpload() {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [report, setReport] = useState(null);

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'products-template.csv';
    a.click();
  };
  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result || ''));
    reader.readAsText(f);
  };
  const validate = async () => {
    try {
      setReport(await inventoryApi.catalogValidate({ csv: text, fileName }));
      toast.success('Validated — nothing saved yet');
    } catch (e) { toast.error(e.response?.data?.message || e.message); }
  };
  const doConfirm = async (force = false) => {
    if (!report?.batchId) return;
    if (!force && !window.confirm(`Apply ${report.okRows} rows?`)) return;
    try {
      const r = await inventoryApi.catalogConfirm({ batchId: report.batchId, force });
      toast.success(`Created ${r.created}, updated ${r.updated}, skipped ${r.skipped}`);
      setReport(null);
      setText('');
    } catch (e) { toast.error(e.response?.data?.message || e.message); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap gap-2 items-center mb-3">
          <button onClick={downloadTemplate} className={btnGhost}>Download CSV template</button>
          <label className={btnGhost} style={{ cursor: 'pointer' }}>Choose CSV file<input type="file" accept=".csv" className="hidden" onChange={onFile} /></label>
          {fileName && <span className="text-xs text-gray-500">{fileName} ({(text.length / 1024).toFixed(1)} KB)</span>}
        </div>
        <textarea className={inputCls} rows={6} placeholder="...or paste CSV here (name,sku,category,regularPrice,salePrice,costPrice,stock,minStock,unit,size,color,vatExempt,isActive)" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex gap-2 mt-3">
          <button onClick={validate} className={btnPrimary} disabled={!text}>1. Validate (dry-run)</button>
        </div>
        <p className="text-[11px] text-gray-500 mt-2">Columns: name*, category*, sku, regularPrice*, salePrice, costPrice, stock, minStock, unit, size, color, vatExempt, isActive, <b>images</b> (| separated URLs, max 5), <b>mainImage</b> (1-5), <b>videos</b> (1 URL). Any provider link works (Cloudinary now, others later). Matching SKU = update (media replaces only if columns filled), else create.</p>
      </Card>
      {report && (
        <Card>
          <h3 className="font-semibold text-sm mb-2">Validation report — batch {report.batchId}</h3>
          <p className="text-xs mb-2">Total {report.totalRows} • OK <b className="text-green-600">{report.okRows}</b> • Errors <b className="text-red-600">{report.errorRows}</b> • Price warnings {report.warnings}</p>
          {report.errors?.length > 0 && (
            <div className="max-h-40 overflow-y-auto mb-3 text-xs">
              {report.errors.map((e, i) => <p key={i} className="py-1 border-t border-black/5 text-red-600">Row {e.rowNumber}: {e.message}</p>)}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => doConfirm(false)} className={btnPrimary} disabled={!report.okRows}>2. Confirm import</button>
            {report.warnings > 0 && <button onClick={() => doConfirm(true)} className={btnDanger}>Force (apply price warnings too)</button>}
          </div>
        </Card>
      )}
    </div>
  );
}

function Batches() {
  const [rows, setRows] = useState([]);
  const load = async () => setRows((await inventoryApi.catalogBatches().catch(() => [])) || []);
  useEffect(() => { load(); }, []);
  const rollback = async (batchId) => {
    if (!confirm(`Roll back ${batchId}? Created products deactivate, updates restore.`)) return;
    try {
      const r = await inventoryApi.catalogRollback(batchId);
      toast.success(`Deactivated ${r.deactivated}, restored ${r.restored}`);
      load();
    } catch (e) { toast.error(e.response?.data?.message || e.message); }
  };
  return (
    <Card>
      {rows.length === 0 ? <Empty text="No import batches yet" /> : (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500"><th className="p-2">Batch</th><th className="p-2">File</th><th className="p-2">Rows</th><th className="p-2">Status</th><th className="p-2">By</th><th className="p-2">Action</th></tr></thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b._id} className="border-t border-black/5">
                <td className="p-2 font-medium">{b.batchId}</td>
                <td className="p-2 text-xs">{b.fileName}</td>
                <td className="p-2 text-xs">{b.okRows}/{b.totalRows}</td>
                <td className="p-2"><Badge value={b.status} /></td>
                <td className="p-2 text-xs">{b.createdBy?.name}</td>
                <td className="p-2">{b.status === 'CONFIRMED' && <button onClick={() => rollback(b.batchId)} className={btnDanger}>Rollback</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
