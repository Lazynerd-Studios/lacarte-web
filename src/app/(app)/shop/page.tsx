'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ShoppingBag,
  Search,
  Plus,
  Minus,
  Package,
  Truck,
  ArrowRight,
  ShoppingCart,
} from 'lucide-react';
import { StoreService } from '@/lib/services/api-services';
import { useCart } from '@/providers/app-providers';
import { formatGhs } from '@/lib/currency';
import { NetworkErrorView, PageLoader } from '@/components/ui/common';

export default function ShopCatalogPage() {
  const {
    items,
    totalCount,
    subtotal,
    freeDeliveryMinQuantity,
    addToCart,
    setQuantity,
    isMutating,
  } = useCart();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const categoriesQuery = useQuery({
    queryKey: ['store-categories'],
    queryFn: () => StoreService.getCategories(),
  });

  const productsQuery = useQuery({
    queryKey: ['store-products', page],
    queryFn: () => StoreService.getProducts(page, 20),
  });

  const categories = categoriesQuery.data || [];
  // The verified products endpoint pages the catalog only (no server-side
  // category/search filter), so the active pills narrow the loaded page.
  const products = (productsQuery.data?.data || []).filter((product) => {
    if (selectedCategoryId && product.categoryId !== selectedCategoryId) {
      return false;
    }
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      product.name.toLowerCase().includes(term) ||
      product.description.toLowerCase().includes(term)
    );
  });

  const getCartItem = (productId: string) =>
    items.find((i) => i.productId === productId);

  return (
    <div className="space-y-6">
      {/* Top Header & Order History Link */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">LaCarte Eco Store</h1>
          <p className="text-sm text-gray-500">
            Durable waste bins, recycling bags, and sanitation supplies delivered to your doorstep
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/orders"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-800"
          >
            <Package className="w-4 h-4 text-[#307224]" />
            My Orders
          </Link>
          <Link
            href="/cart"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#307224] hover:bg-[#25591c] text-white text-xs font-bold shadow-xs"
          >
            <ShoppingCart className="w-4 h-4" />
            Cart ({totalCount})
          </Link>
        </div>
      </div>

      {/* Free Delivery Progress Banner */}
      {freeDeliveryMinQuantity != null && freeDeliveryMinQuantity > 0 && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs font-bold text-emerald-900">
            <Truck className="w-4 h-4 text-[#307224] shrink-0" />
            {totalCount >= freeDeliveryMinQuantity ? (
              <span>You unlocked FREE delivery for your zone!</span>
            ) : (
              <span>
                Add <strong>{freeDeliveryMinQuantity - totalCount} more item(s)</strong>{' '}
                to unlock FREE delivery in your zone (orders of {freeDeliveryMinQuantity}+ items).
              </span>
            )}
          </div>
          {totalCount > 0 && (
            <Link
              href="/checkout"
              className="text-xs font-extrabold text-[#307224] hover:underline flex items-center gap-1"
            >
              Checkout ({formatGhs(subtotal)}) <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      )}

      {/* Category Pills & Search */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => {
              setSelectedCategoryId('');
              setPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategoryId === ''
                ? 'bg-[#307224] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Products
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setSelectedCategoryId(cat.id);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                selectedCategoryId === cat.id
                  ? 'bg-[#307224] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search bins, liners, supplies..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-[#307224]"
          />
        </div>
      </div>

      {/* Product Grid */}
      {productsQuery.isLoading ? (
        <PageLoader label="Loading Eco Store catalog..." />
      ) : productsQuery.isError ? (
        <NetworkErrorView onRetry={() => productsQuery.refetch()} />
      ) : products.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center">
          <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-800">No products found</h3>
          <p className="text-xs text-gray-500 mt-1">
            Try clearing your search filter or selecting another category.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {products.map((product) => {
            const cartItem = getCartItem(product.id);
            const qty = cartItem?.quantity || 0;
            const imgUrl = product.images[0];
            return (
              <div
                key={product.id}
                className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between hover:border-[#307224]/40 transition group"
              >
                <Link href={`/shop/${product.id}`} className="block">
                  <div className="aspect-4/3 bg-gray-100 relative overflow-hidden">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <ShoppingBag className="w-10 h-10" />
                      </div>
                    )}
                    {!product.isAvailable && (
                      <span className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-gray-900/80 text-white text-[10px] font-bold uppercase">
                        Out of Stock
                      </span>
                    )}
                  </div>

                  <div className="p-4">
                    {product.categoryName && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#307224]">
                        {product.categoryName}
                      </span>
                    )}
                    <h3 className="text-sm font-bold text-gray-900 line-clamp-1 mt-0.5">
                      {product.name}
                    </h3>
                    {product.description && (
                      <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                        {product.description}
                      </p>
                    )}
                  </div>
                </Link>

                <div className="px-4 pb-4 pt-2 border-t border-gray-50 flex items-center justify-between gap-2">
                  <div className="text-base font-extrabold text-gray-900">
                    {formatGhs(product.price)}
                  </div>

                  {qty > 0 ? (
                    <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-2 py-1">
                      <button
                        type="button"
                        onClick={() => cartItem && setQuantity(cartItem, qty - 1)}
                        disabled={isMutating}
                        className="p-1 text-[#307224] hover:bg-emerald-100 rounded-lg cursor-pointer disabled:cursor-wait disabled:opacity-50"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-extrabold text-gray-900 min-w-[18px] text-center">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => cartItem && setQuantity(cartItem, qty + 1)}
                        disabled={isMutating}
                        className="p-1 text-[#307224] hover:bg-emerald-100 rounded-lg cursor-pointer disabled:cursor-wait disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!product.isAvailable || isMutating}
                      onClick={() => addToCart(product.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#307224] hover:bg-[#25591c] disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-bold transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

