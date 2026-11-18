import { Card, PageHead, inputCls, btnPrimary } from './widgets';

export default function SupportSettings() {
  return (
    <div>
      <PageHead title="Support Settings" sub="Business rules live in DB/settings — never hard-coded" />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-semibold text-sm mb-2">AI Confidence Threshold</h3>
          <p className="text-xs text-gray-500 mb-2">Backend reads <code>AI_CONFIDENCE_THRESHOLD</code> (default 0.75). Below threshold → auto human handoff.</p>
          <div className="flex gap-2"><input className={inputCls} placeholder="0.75" /><button className={btnPrimary}>Save (.env)</button></div>
        </Card>
        <Card>
          <h3 className="font-semibold text-sm mb-2">Data Retention</h3>
          <p className="text-xs text-gray-500">Chat + ticket history is never hard-deleted. Sensitive records use ACTIVE / ARCHIVED / VOIDED lifecycle. Seed defaults via <code>node utils/seedSupport.js</code>.</p>
        </Card>
        <Card>
          <h3 className="font-semibold text-sm mb-2">Security</h3>
          <p className="text-xs text-gray-500">JWT + RBAC + permission checks on every route. AI tools audited. Financial writes require SUPPORT_REFUND_* permission.</p>
        </Card>
        <Card>
          <h3 className="font-semibold text-sm mb-2">Seed</h3>
          <p className="text-xs text-gray-500 mb-2">16 categories • 8 teams • 6 canned • 5 FAQs</p>
          <code className="text-xs bg-black/5 p-2 rounded block">cd backend; node utils/seedSupport.js</code>
        </Card>
      </div>
    </div>
  );
}
