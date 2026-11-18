import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle } from 'lucide-react';

export default function PaymentResult({ type = 'success' }) {
  const [params] = useSearchParams();
  const order = params.get('order');
  const trx = params.get('trx');
  const gateway = params.get('gateway');
  const reason = params.get('reason');
  const isSuccess = type === 'success';

  return (
    <div className="container mx-auto px-4 py-16 max-w-md text-center">
      {isSuccess ? (
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
      ) : (
        <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
      )}
      <h1 className="text-2xl font-bold mb-2">
        {isSuccess ? 'Payment Successful' : 'Payment Failed'}
      </h1>
      <p className="text-gray-600 mb-6">
        {isSuccess
          ? 'Thank you! Your payment has been received.'
          : reason === 'cancelled'
          ? 'You cancelled the payment.'
          : 'Payment could not be completed. You can try again from My Orders.'}
      </p>
      {(order || trx || gateway) && (
        <div className="card p-4 text-left text-sm mb-6 space-y-1">
          {order && (
            <div className="flex justify-between">
              <span className="text-gray-500">Order</span>
              <span className="font-medium">#{order}</span>
            </div>
          )}
          {trx && (
            <div className="flex justify-between">
              <span className="text-gray-500">Transaction</span>
              <span className="font-mono text-xs">{trx}</span>
            </div>
          )}
          {gateway && (
            <div className="flex justify-between">
              <span className="text-gray-500">Gateway</span>
              <span className="uppercase">{gateway}</span>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {order && (
          <Link to="/orders" className="btn-primary">
            View Orders
          </Link>
        )}
        <Link to="/shop" className="btn-outline">
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
