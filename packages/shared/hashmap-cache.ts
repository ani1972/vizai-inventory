// packages/shared/hashmap-cache.ts
// Req 16: HashMap cache with djb2 hashing, 16 buckets, chaining
// O(1) SKU lookup for chatbot and dashboard hot paths

import type { HashMapEntry } from './types'

const BUCKET_COUNT = 16

function djb2(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
    hash = hash >>> 0  // keep unsigned 32-bit
  }
  return hash % BUCKET_COUNT
}

export class VizAIHashMap {
  private buckets: Map<string, HashMapEntry>[] = Array.from(
    { length: BUCKET_COUNT }, () => new Map()
  )
  private totalEntries = 0
  private hitCount    = 0
  private missCount   = 0

  put(sku: string, itemId: string, name: string, stock: number): void {
    const bucket = djb2(sku)
    const chain  = this.buckets[bucket]
    const existing = chain.get(sku)
    chain.set(sku, {
      sku,
      item_id:     itemId,
      name,
      stock,
      bucket,
      chain_pos:   existing ? existing.chain_pos : chain.size,
      hits:        existing ? existing.hits : 0,
      inserted_at: existing ? existing.inserted_at : Date.now(),
    })
    if (!existing) this.totalEntries++
  }

  get(sku: string): HashMapEntry | null {
    const bucket = djb2(sku)
    const entry  = this.buckets[bucket].get(sku)
    if (entry) {
      entry.hits++
      this.hitCount++
      return entry
    }
    this.missCount++
    return null
  }

  updateStock(sku: string, newStock: number): boolean {
    const bucket = djb2(sku)
    const entry  = this.buckets[bucket].get(sku)
    if (!entry) return false
    entry.stock = newStock
    return true
  }

  delete(sku: string): boolean {
    const bucket = djb2(sku)
    const deleted = this.buckets[bucket].delete(sku)
    if (deleted) this.totalEntries--
    return deleted
  }

  // Diagnostics for HashMap Cache dashboard page
  stats() {
    const chainLengths = this.buckets.map(b => b.size)
    const maxChain     = Math.max(...chainLengths)
    const loadFactor   = this.totalEntries / BUCKET_COUNT

    return {
      total_entries: this.totalEntries,
      bucket_count:  BUCKET_COUNT,
      load_factor:   parseFloat(loadFactor.toFixed(3)),
      max_chain:     maxChain,
      hit_count:     this.hitCount,
      miss_count:    this.missCount,
      hit_rate_pct:  this.hitCount + this.missCount > 0
        ? parseFloat(((this.hitCount / (this.hitCount + this.missCount)) * 100).toFixed(1))
        : 0,
      buckets: chainLengths.map((len, i) => ({
        index: i,
        size:  len,
        entries: Array.from(this.buckets[i].values()).map(e => ({
          sku:       e.sku,
          name:      e.name,
          stock:     e.stock,
          hits:      e.hits,
          chain_pos: e.chain_pos,
        })),
      })),
    }
  }

  // Bulk load from DB (called on startup and after Zoho sync)
  bulkLoad(items: Array<{ sku: string; id: string; name: string; current_stock: number }>) {
    items.forEach(i => this.put(i.sku, i.id, i.name, i.current_stock))
  }
}

// Singleton export — shared across all MCP workers in same process
export const vizaiCache = new VizAIHashMap()
