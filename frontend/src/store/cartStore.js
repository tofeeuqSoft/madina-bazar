import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';
import useAuthStore from './authStore';

const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,

      // Local cart helpers (guest)
      addLocalItem: (product, quantity = 1, variant = {}) => {
        const size = variant.size || '';
        const color = variant.color || '';
        const items = [...get().items];
        const existing = items.find(
          (i) =>
            (i.productId === product._id || i.product?._id === product._id) &&
            (i.size || '') === size &&
            (i.color || '') === color
        );
        if (existing) {
          existing.quantity += quantity;
        } else {
          items.push({
            _id: `local-${product._id}-${size}-${color}`,
            productId: product._id,
            product,
            quantity,
            price: product.salePrice || product.regularPrice,
            size,
            color,
            colorCode: variant.colorCode || '',
          });
        }
        set({ items });
      },

      updateLocalQuantity: (key, quantity) => {
        let items = [...get().items];
        if (quantity <= 0) {
          items = items.filter(
            (i) => i._id !== key && i.productId !== key && i.product?._id !== key
          );
        } else {
          const item = items.find(
            (i) => i._id === key || i.productId === key || i.product?._id === key
          );
          if (item) item.quantity = quantity;
        }
        set({ items });
      },

      removeLocalItem: (key) => {
        set({
          items: get().items.filter(
            (i) => i._id !== key && i.productId !== key && i.product?._id !== key
          ),
        });
      },

      clearLocal: () => set({ items: [] }),

      // Server cart (logged in)
      fetchCart: async () => {
        const { isAuthenticated } = useAuthStore.getState();
        if (!isAuthenticated) return;

        set({ isLoading: true });
        try {
          const { data } = await api.get('/cart');
          const items = (data.data?.items || []).map((item) => ({
            _id: item._id,
            productId: item.product?._id,
            product: item.product,
            combo: item.combo,
            quantity: item.quantity,
            price: item.product?.salePrice || item.product?.regularPrice || item.combo?.salePrice,
            size: item.size || '',
            color: item.color || '',
            colorCode: item.colorCode || '',
          }));
          set({ items, isLoading: false });
        } catch (err) {
          set({ isLoading: false });
        }
      },

      addToCart: async (product, quantity = 1, variant = {}) => {
        const { isAuthenticated } = useAuthStore.getState();

        if (!isAuthenticated) {
          get().addLocalItem(product, quantity, variant);
          return { success: true, message: 'Added to cart' };
        }

        try {
          await api.post('/cart', {
            productId: product._id,
            quantity,
            size: variant.size || '',
            color: variant.color || '',
            colorCode: variant.colorCode || '',
          });
          await get().fetchCart();
          return { success: true, message: 'Added to cart' };
        } catch (err) {
          // Server rejected (e.g. missing variant, out of stock) — surface it
          if (err.response) {
            return { success: false, message: err.response.data?.message || 'Failed to add to cart' };
          }
          // Offline / network error — fallback to local
          get().addLocalItem(product, quantity, variant);
          return { success: true, message: 'Added to cart (local)' };
        }
      },

      updateQuantity: async (itemIdOrProductId, quantity) => {
        const { isAuthenticated } = useAuthStore.getState();
        if (!isAuthenticated) {
          get().updateLocalQuantity(itemIdOrProductId, quantity);
          return;
        }
        try {
          if (quantity <= 0) {
            await api.delete(`/cart/${itemIdOrProductId}`);
          } else {
            await api.put(`/cart/${itemIdOrProductId}`, { quantity });
          }
          await get().fetchCart();
        } catch (err) {
          get().updateLocalQuantity(itemIdOrProductId, quantity);
        }
      },

      removeItem: async (itemIdOrProductId) => {
        const { isAuthenticated } = useAuthStore.getState();
        if (!isAuthenticated) {
          get().removeLocalItem(itemIdOrProductId);
          return;
        }
        try {
          await api.delete(`/cart/${itemIdOrProductId}`);
          await get().fetchCart();
        } catch (err) {
          get().removeLocalItem(itemIdOrProductId);
        }
      },

      clearCart: async () => {
        const { isAuthenticated } = useAuthStore.getState();
        if (!isAuthenticated) {
          get().clearLocal();
          return;
        }
        try {
          await api.delete('/cart');
          set({ items: [] });
        } catch (err) {
          set({ items: [] });
        }
      },

      getItemCount: () => get().items.reduce((acc, i) => acc + i.quantity, 0),

      getSubtotal: () =>
        get().items.reduce((acc, i) => acc + (i.price || 0) * i.quantity, 0),
    }),
    {
      name: 'madina-cart',
      partialize: (state) => ({ items: state.items }),
    }
  )
);

export default useCartStore;
