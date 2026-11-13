'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ShoppingBag, Plus, Minus, ShoppingCart, CheckCircle2 } from 'lucide-react';
import { StoreService } from '@/lib/services/api-services';
import { useCart } from '@/providers/app-providers';
import { formatGhs } from '@/lib/currency';
import { NetworkErrorView, PageLoader } from '@/components/ui/common';

export default function ProductDetailPage() {
  const { id: productId } = useParams<{ id: string }>();
  const router = useRouter();
  const { items, addToCart, setQuantity, isMutating } = useCart();
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);

  const { data: product, isLoading, isError, refetch } = useQuery({
    queryKey: ['store-product', productId],
    queryFn: () => StoreService.getProductById(productId),
    enabled: Boolean(productId),
  });

  if (isLoading) return <PageLoader label="Loading product details..." />;
  if (isError || !product) return <NetworkErrorView onRetry={() => refetch()} />;

  const cartItem = product.id
    ? items.find((i) => i.productId && i.productId === product.id)
    : undefined;
  const cartQty = cartItem?.quantity || 0;
  const images = product.images;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Shop
        </button>

        <Link
          href="/cart"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#307224] text-white text-xs font-bold"
        >
          <ShoppingCart className="w-4 h-4" /> View Cart
        </Link>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Image Gallery */}
        <div className="space-y-3">
          <div className="aspect-square rounded-2xl bg-gray-100 overflow-hidden">
            {images[selectedImageIdx] ? (
              <img
                src={images[selectedImageIdx]}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">
                <ShoppingBag className="w-16 h-16" />
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedImageIdx(idx)}
                  className={`w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 ${
                    selectedImageIdx === idx ? 'border-[#307224]' : 'border-transparent'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info & Cart Controls */}
        <div className="flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#307224]">
                {product.categoryName || 'Eco Store'}
              </span>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  product.isAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                }`}
              >
                {product.isAvailable ? 'In Stock' : 'Out of Stock'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{product.name}</h1>
            <div className="text-2xl font-extrabold text-[#307224]">{formatGhs(product.price)}</div>

            <p className="text-sm text-gray-600 leading-relaxed">
              {product.description ||
                'High-durability waste bin and sanitation product designed for residential and commercial waste collection.'}
            </p>
          </div>

          <div className="pt-6 border-t border-gray-100 space-y-4">
            {cartQty > 0 ? (
              <div className="flex items-center justify-between gap-4">
                <div className="inline-flex items-center gap-4 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => cartItem && setQuantity(cartItem, cartQty - 1)}
                    disabled={isMutating}
                    className="p-1 text-[#307224] cursor-pointer disabled:cursor-wait disabled:opacity-50"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-base font-extrabold text-gray-900">{cartQty} in cart</span>
                  <button
                    type="button"
                    onClick={() => cartItem && setQuantity(cartItem, cartQty + 1)}
                    disabled={isMutating}
                    className="p-1 text-[#307224] cursor-pointer disabled:cursor-wait disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <Link
                  href="/checkout"
                  className="flex-1 py-3.5 px-6 rounded-2xl bg-[#307224] hover:bg-[#25591c] text-white text-xs font-bold text-center"
                >
                  Proceed to Checkout
                </Link>
              </div>
            ) : (
              <button
                type="button"
                disabled={!product.isAvailable || isMutating}
                onClick={() => addToCart(product.id)}
                className="w-full py-4 px-6 rounded-2xl bg-[#307224] hover:bg-[#25591c] disabled:bg-gray-200 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" /> Add to Cart
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

