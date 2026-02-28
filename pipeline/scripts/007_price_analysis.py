#!/usr/bin/env python3
"""
Price Analysis Data Export Script
Analyzes price movements and exports structured data for LLM processing.
Updated to focus exclusively on tcg_low prices.
"""

import json
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import statistics

def load_printings_data(filepath: Path) -> Optional[Dict]:
    """Load JSON Lines file into a dictionary keyed by printing_id."""
    data = {}
    print(f"Loading data from {filepath.name}...")
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                try:
                    record = json.loads(line)
                    if 'printing_id' in record:
                        data[record['printing_id']] = record
                except json.JSONDecodeError:
                    continue
    except FileNotFoundError:
        print(f"Error: File not found at {filepath}")
        return None
    print(f" -> Loaded {len(data):,} records.")
    return data

def analyze_price_changes(old_data: Dict, new_data: Dict) -> Dict:
    """Analyze price changes between two datasets using tcg_low only."""
    price_changes = []
    stats = {'total_comparisons': 0, 'increases': 0, 'decreases': 0}
    
    for printing_id, new_card in new_data.items():
        old_card = old_data.get(printing_id)
        
        if not old_card:
            continue

        old_price = old_card.get('tcg_low')
        new_price = new_card.get('tcg_low')
        
        if old_price is None or new_price is None or old_price <= 0:
            continue
            
        net_change = new_price - old_price
        percent_change = ((net_change / old_price) * 100) if old_price > 0 else 0
        stats['total_comparisons'] += 1
        
        if net_change > 0:
            stats['increases'] += 1
        elif net_change < 0:
            stats['decreases'] += 1
        
        price_changes.append({
            'printing_id': printing_id,
            'card_name': new_card.get('display_name', 'Unknown Card'),
            'set': new_card.get('set', ''),
            'edition': new_card.get('edition', ''),
            'rarity': new_card.get('rarity', ''),
            'foiling': new_card.get('foiling', ''),
            'type_text': new_card.get('type_text', ''),
            'old_price': old_price,
            'new_price': new_price,
            'net_change': net_change,
            'percent_change': percent_change
        })

    price_changes.sort(key=lambda x: x['net_change'], reverse=True)
    
    increases = [c for c in price_changes if c['net_change'] > 0]
    decreases = [c for c in price_changes if c['net_change'] < 0]
    
    # Filter for significant movements
    significant_increases = [c for c in increases if c['net_change'] >= 3.0][:20]
    significant_decreases = [c for c in decreases if abs(c['net_change']) >= 3.0][:20]
    
    return {
        'stats': stats,
        'significant_increases': significant_increases,
        'significant_decreases': significant_decreases,
        'top_increases': increases[:10],
        'top_decreases': decreases[:10]
    }

def analyze_price_volatility(old_data: Dict, new_data: Dict) -> List[Dict]:
    """Find cards with high price volatility (large percentage changes)."""
    volatile_cards = []
    
    for printing_id, new_card in new_data.items():
        old_card = old_data.get(printing_id)
        
        if not old_card:
            continue

        old_price = old_card.get('tcg_low')
        new_price = new_card.get('tcg_low')
        
        if old_price is None or new_price is None or old_price <= 0:
            continue
            
        percent_change = abs(((new_price - old_price) / old_price) * 100)
        
        # Only include cards with significant percentage changes (20%+)
        if percent_change >= 20.0:
            volatile_cards.append({
                'printing_id': printing_id,
                'card_name': new_card.get('display_name', 'Unknown Card'),
                'set': new_card.get('set', ''),
                'edition': new_card.get('edition', ''),
                'foiling': new_card.get('foiling', ''),
                'rarity': new_card.get('rarity', ''),
                'type_text': new_card.get('type_text', ''),
                'old_price': old_price,
                'new_price': new_price,
                'net_change': new_price - old_price,
                'percent_change': ((new_price - old_price) / old_price) * 100,
                'volatility_score': percent_change
            })

    volatile_cards.sort(key=lambda x: x['volatility_score'], reverse=True)
    return volatile_cards[:15]

def analyze_price_momentum(old_data: Dict, new_data: Dict) -> List[Dict]:
    """Find cards showing strong momentum (consistent direction with significant change)."""
    momentum_cards = []

    for printing_id, new_card in new_data.items():
        old_card = old_data.get(printing_id)
        
        if not old_card:
            continue

        old_price = old_card.get('tcg_low')
        new_price = new_card.get('tcg_low')
        
        if old_price is None or new_price is None or old_price <= 0:
            continue

        net_change = new_price - old_price
        percent_change = ((net_change / old_price) * 100) if old_price > 0 else 0
        
        # Look for strong momentum: significant change (>$5 OR >25%) 
        # in either direction with reasonable base price (>$10)
        if old_price >= 10.0 and (abs(net_change) >= 5.0 or abs(percent_change) >= 25.0):
            momentum_score = abs(net_change) + (abs(percent_change) / 10.0)
            
            momentum_cards.append({
                'printing_id': printing_id,
                'card_name': new_card.get('display_name', 'Unknown Card'),
                'set': new_card.get('set', ''),
                'edition': new_card.get('edition', ''),
                'foiling': new_card.get('foiling', ''),
                'rarity': new_card.get('rarity', ''),
                'type_text': new_card.get('type_text', ''),
                'old_price': old_price,
                'new_price': new_price,
                'net_change': net_change,
                'percent_change': percent_change,
                'momentum_score': momentum_score,
                'direction': 'up' if net_change > 0 else 'down'
            })

    momentum_cards.sort(key=lambda x: x['momentum_score'], reverse=True)
    return momentum_cards[:15]

def analyze_value_opportunities(price_changes: List[Dict]) -> List[Dict]:
    """Find undervalued cards based on recent drops and rarity."""
    opportunities = []
    
    for card in price_changes:
        if card['net_change'] >= 0:  # Only look at price decreases
            continue
            
        rarity = card.get('rarity', '').lower()
        type_text = card.get('type_text', '').lower()
        old_price = card['old_price']
        drop_amount = abs(card['net_change'])
        drop_percent = abs(card['percent_change'])
        
        # Score based on multiple factors
        opportunity_score = 0
        
        # Rarity bonus
        if rarity == 'l':  # Legendary
            opportunity_score += 3
        elif rarity == 'm':  # Majestic  
            opportunity_score += 2
        elif rarity == 'f':  # Fabled
            opportunity_score += 4
        
        # Type bonus
        if 'equipment' in type_text:
            opportunity_score += 1
        elif 'hero' in type_text:
            opportunity_score += 2
            
        # Price drop significance
        if drop_percent >= 30:
            opportunity_score += 3
        elif drop_percent >= 20:
            opportunity_score += 2
        elif drop_percent >= 10:
            opportunity_score += 1
            
        # Absolute drop bonus (prevents penny stock manipulation)
        if drop_amount >= 10:
            opportunity_score += 2
        elif drop_amount >= 5:
            opportunity_score += 1
            
        # Only include cards with meaningful opportunity scores
        if opportunity_score >= 3:
            opportunities.append({
                **card,
                'opportunity_score': opportunity_score
            })
    
    opportunities.sort(key=lambda x: x['opportunity_score'], reverse=True)
    return opportunities[:12]

def categorize_opportunities(cards: List[Dict]) -> Dict[str, List[Dict]]:
    """Categorize cards by type for themed analysis."""
    categories = {
        'equipment': [],
        'legendary': [], 
        'majestic': [],
        'promo': [],
        'heroes': []
    }
    
    for card in cards:
        type_text = card.get('type_text', '').lower()
        rarity = card.get('rarity', '').lower()
        
        if 'equipment' in type_text:
            categories['equipment'].append(card)
        elif 'hero' in type_text:
            categories['heroes'].append(card)
        elif rarity == 'l':
            categories['legendary'].append(card)
        elif rarity == 'm':
            categories['majestic'].append(card)
        elif rarity == 'p':
            categories['promo'].append(card)
    
    # Remove empty categories and limit to top 8 per category
    return {k: v[:8] for k, v in categories.items() if v}

def export_analysis_data(old_file: Path, new_file: Path, output_file: str):
    """Main function to analyze and export data for LLM processing."""
    print("=== PRICE ANALYSIS DATA EXPORT (TCG LOW ONLY) ===")
    
    # Load data
    old_data = load_printings_data(old_file)
    new_data = load_printings_data(new_file)
    
    if old_data is None or new_data is None:
        return False
    
    print("\nAnalyzing price movements...")
    price_analysis = analyze_price_changes(old_data, new_data)
    
    print("Analyzing price volatility...")
    volatility_analysis = analyze_price_volatility(old_data, new_data)
    
    print("Analyzing price momentum...")
    momentum_analysis = analyze_price_momentum(old_data, new_data)
    
    print("Finding value opportunities...")
    all_changes = []
    for printing_id, new_card in new_data.items():
        old_card = old_data.get(printing_id)
        if old_card and old_card.get('tcg_low') and new_card.get('tcg_low'):
            old_price = old_card['tcg_low']
            new_price = new_card['tcg_low']
            if old_price > 0:
                all_changes.append({
                    'printing_id': printing_id,
                    'card_name': new_card.get('display_name', 'Unknown Card'),
                    'set': new_card.get('set', ''),
                    'edition': new_card.get('edition', ''),
                    'rarity': new_card.get('rarity', ''),
                    'foiling': new_card.get('foiling', ''),
                    'type_text': new_card.get('type_text', ''),
                    'old_price': old_price,
                    'new_price': new_price,
                    'net_change': new_price - old_price,
                    'percent_change': ((new_price - old_price) / old_price) * 100
                })
    
    value_opportunities = analyze_value_opportunities(all_changes)
    
    # Categorize opportunities
    buying_categories = categorize_opportunities(price_analysis['significant_decreases'])
    selling_categories = categorize_opportunities(price_analysis['significant_increases'])
    
    # Compile export data
    export_data = {
        'analysis_date': datetime.now().strftime('%Y-%m-%d'),
        'market_stats': price_analysis['stats'],
        'selling_opportunities': {
            'hot_movers': price_analysis['significant_increases'][:10],
            'by_category': selling_categories
        },
        'buying_opportunities': {
            'major_drops': price_analysis['significant_decreases'][:10],
            'by_category': buying_categories
        },
        'advanced_strategies': {
            'high_volatility': volatility_analysis,
            'strong_momentum': momentum_analysis,
            'value_opportunities': value_opportunities
        },
        'llm_context': {
            'prompt_instructions': "Use this data to write a natural market analysis article focusing on tcg_low price movements. Focus on storytelling and insights rather than raw numbers. Reference specific cards with their printing IDs for interactive components.",
            'suggested_narrative_flow': [
                "Market pulse opening",
                "Selling opportunities (hot movers)",
                "Buying opportunities (corrections/drops)", 
                "Advanced strategies (volatility/momentum/value)",
                "Market outlook and timing thoughts"
            ]
        }
    }
    
    # Save to file
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, indent=2, ensure_ascii=False)
        print(f"\nData exported successfully to: {output_file}")
        
        # Print summary
        print(f"\nEXPORT SUMMARY:")
        print(f"Cards analyzed: {price_analysis['stats']['total_comparisons']:,}")
        print(f"Significant increases: {len(price_analysis['significant_increases'])}")
        print(f"Significant decreases: {len(price_analysis['significant_decreases'])}")
        print(f"High volatility cards: {len(volatility_analysis)}")
        print(f"Strong momentum cards: {len(momentum_analysis)}")
        print(f"Value opportunities: {len(value_opportunities)}")
        print(f"Buying categories found: {list(buying_categories.keys())}")
        print(f"Selling categories found: {list(selling_categories.keys())}")
        
        return True
        
    except Exception as e:
        print(f"Error saving export data: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(
        description='Export price analysis data for LLM article generation (TCG Low prices only).'
    )
    
    parser.add_argument('old_file', type=Path, help='Path to older printings file')
    parser.add_argument('new_file', type=Path, help='Path to newer printings file') 
    parser.add_argument('--output', '-o', default='market_analysis_export.json',
                       help='Output filename (default: market_analysis_export.json)')
    
    args = parser.parse_args()
    
    success = export_analysis_data(args.old_file, args.new_file, args.output)
    exit(0 if success else 1)

if __name__ == "__main__":
    main()