import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import orderAdminApi from '../../../services/orderAdmin';
import { Card, PageHead } from './widgets';

export default function OrderDashboard() {
  const [d, setD] = useState(null);
  useEffect(() => { orderAdminApi.dashboard().then(setD).catch(() => {}); }, []);

  const cards = [
    ['Total Orders', d?.totalOrders, '/admin/order-mgmt/orders'],
    ["Today's Orders", d?.todaysOrders, '/admin/order-mgmt/orders'],
    ['Pending Verification', d?.pendingVerification, '/admin/order-mgmt/orders?status=PENDING_VERIFICATION'],
    ['Confirmed', d?.confirmed, '/admin/order-mgmt/orders?status=Confirmed'],
    ['Processing', d?.processing, '/admin/order-mgmt/orders?status=Processing'],
    ['Ready to Ship', d?.readyToShip, '/admin/order-mgmt/orders?status=READY_TO_SHIP'],
    ['Shipped', d?.shipped, '/admin/order-mgmt/orders?status=Shipped'],
    ['Out for Delivery', d?.outForDelivery, '/admin/order-mgmt/orders?status=OUT_FOR_DELIVERY'],
    ['Delivered', d?.delivered, '/admin/order-mgmt/orders?status=Delivered'],
    ['On Hold', d?.onHold, '/admin/order-mgmt/orders?status=ON_HOLD'],
    ['Cancelled', d?.cancelled, '/admin/order-mgmt/orders?status=Cancelled'],
    ['Failed', d?.failed, '/admin/order-mgmt/orders?status=FAILED'],
    ['Unassigned', d?.unassignedOrders, '/admin/order-mgmt/assignment'],
    ['High Priority', d?.highPriorityOrders, '/admin/order-mgmt/orders'],
    ['Urgent', d?.urgentOrders, '/admin/order-mgmt/orders'],
  ];

  return (
    <div>
      <PageHead title="Order Management Dashboard" sub="Live aggregation from Order Service — no mock data" />
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        {cards.map(([label, value, link]) => (
          <Link key={label} to={link}><Card><p className="text-xs text-gray-500 dark:text-ash">{label}</p><p className="text-2xl font-bold mt-1">{value ?? '…'}</p></Card></Link>
        ))}
      </div>
      <div className="grid md:grid-cols-4 gap-4">
        {[['COD Orders', d?.codOrders], ['Online Paid', d?.onlinePaidOrders], ["Today's Sales ৳", d?.todaysSales], ['Avg Order ৳', d?.averageOrderValue]].map(([l, v]) => (
          <Card key={l}><p className="text-xs text-gray-500">{l}</p><p className="text-xl font-bold">{v ?? '…'}</p></Card>
        ))}
      </div>
      <div className="grid md:grid-cols-3 gap-4 mt-4">
        {[['Grocery Orders', d?.groceryOrders], ['Nationwide Orders', d?.nationwideOrders], ['Mixed Orders', d?.mixedOrders]].map(([l, v]) => (
          <Card key={l}><p className="text-xs text-gray-500">{l}</p><p className="text-xl font-bold">{v ?? '…'}</p></Card>
        ))}
      </div>
    </div>
  );
}
