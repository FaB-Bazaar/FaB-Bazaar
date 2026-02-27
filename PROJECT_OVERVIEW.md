# FaB Bazaar - Trading Card Platform Overview

## Project Description
FaB Bazaar is a Next.js-based trading card platform specifically designed for Flesh and Blood (FaB) trading cards. It allows users to manage their card collections, create want lists, find trading partners, and facilitate secure trades.

## Tech Stack
- **Framework**: Next.js 15 with App Router
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: NextAuth.js with Discord OAuth + custom JWT
- **Styling**: Tailwind CSS with shadcn/ui components
- **Language**: TypeScript
- **Deployment**: Vercel (based on environment variables)

## Key Features
1. **User Authentication**: Discord OAuth + custom email/password
2. **Card Management**: Add cards to binder, create want lists
3. **Trading System**: Find matches, create trade agreements
4. **Marketplace**: Browse and create listings
5. **Admin Panel**: Card import, metadata management
6. **Real-time Features**: Notifications, trade updates

## Project Structure

### Core Directories
\`\`\`
app/                    # Next.js App Router pages
├── api/               # API routes
├── auth/              # Authentication pages
├── admin/             # Admin panel pages
├── (main pages)/      # Trading, marketplace, profile pages
components/            # Reusable React components
├── ui/               # shadcn/ui base components
├── (feature)/        # Feature-specific components
contexts/             # React contexts (Auth, Cookies)
lib/                  # Utility libraries and services
models/               # MongoDB/Mongoose models
hooks/                # Custom React hooks
types/                # TypeScript type definitions
public/               # Static assets
scripts/              # Database migration/utility scripts
\`\`\`

## Available Models (MongoDB/Mongoose)
\`\`\`typescript
// Import paths for models
import User from "@/models/User"
import Binder from "@/models/Binder" 
import WantsList from "@/models/WantsList"
import Listing from "@/models/Listing"
import Agreement from "@/models/Agreement"
import Message from "@/models/Message"
import Offer from "@/models/Offer"
import CardMetadata from "@/models/CardMetadata"
\`\`\`

## Key Libraries and Services

### Database Connection
\`\`\`typescript
import connectToDatabase from "@/lib/mongodb"
// Always call before database operations
\`\`\`

### Authentication
\`\`\`typescript
import { auth } from "@/auth"
import { getServerSession } from "@/lib/session"
// For server-side auth checks
\`\`\`

### Metadata Service (Client-side)
\`\`\`typescript
import { 
  fetchMetadata, 
  getSetName, 
  getEditionInfo, 
  getFoilingInfo, 
  getRarityInfo 
} from "@/lib/metadata-service"
// For card metadata (sets, rarities, foilings, etc.)
\`\`\`

### Client-side Stores
\`\`\`typescript
import { useListingsStore } from "@/lib/listings-store"
import { useAgreementsStore } from "@/lib/agreements-store"
// Zustand stores for client state management
\`\`\`

## Available UI Components (shadcn/ui)
All components are available from `@/components/ui/`:
- Button, Card, Dialog, Input, Label, Select, Textarea
- Table, Tabs, Toast, Tooltip, Avatar, Badge
- Alert, AlertDialog, Accordion, Checkbox, Switch
- Dropdown, Popover, Sheet, Skeleton, Progress
- And many more...

## Custom Components
Key reusable components in `/components/`:
- `CardDisplay` - Shows card information with metadata
- `RarityBadge`, `FoilingBadge` - Card attribute displays  
- `TradeAgreement` - Trade management interface
- `SearchInput`, `QuickSearch` - Card search functionality
- `CountrySelector`, `StateSelector` - Location inputs
- `ExportDataDialog` - Data export functionality

## Authentication Flow
1. **Discord OAuth**: Primary authentication method
2. **Custom Auth**: Email/password with encrypted storage
3. **Session Management**: JWT tokens with secure cookies
4. **Profile Completion**: New users complete profile after OAuth

## Card Data Structure
Cards have these key properties:
- `name`, `set`, `edition`, `foiling`, `rarity`
- `artVariation`, `pitch` (for game mechanics)
- `imageUrl`, `printingId` (unique identifier)
- Metadata is fetched from `/api/metadata` endpoints

## API Patterns
- **Authentication**: Most API routes require authentication
- **Error Handling**: Consistent error response format
- **Validation**: Zod schemas for request validation
- **Database**: Always connect before operations

## Environment Variables
Key environment variables (already configured):
- `MONGODB_URI`, `MONGODB_DB` - Database connection
- `JWT_SECRET` - Token signing
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL` - NextAuth config
- `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` - OAuth
- Various admin and webhook secrets

## Common Patterns

### API Route Structure
\`\`\`typescript
import { NextRequest, NextResponse } from "next/server"
import connectToDatabase from "@/lib/mongodb"
import { getServerSession } from "@/lib/session"

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase()
    const session = await getServerSession()
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // Your logic here
    
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
\`\`\`

### Component with Metadata
\`\`\`typescript
'use client'
import { useEffect, useState } from 'react'
import { getSetName, getRarityInfo } from '@/lib/metadata-service'

export function CardComponent({ card }) {
  const [setName, setSetName] = useState('')
  const [rarityInfo, setRarityInfo] = useState({ name: '', displayClass: '' })
  
  useEffect(() => {
    getSetName(card.set).then(setSetName)
    getRarityInfo(card.rarity).then(setRarityInfo)
  }, [card])
  
  // Component JSX
}
\`\`\`

## Important Notes
- **File Locking**: Many core files are locked and cannot be modified
- **Authentication**: Working correctly, don't modify auth middleware
- **Database**: MongoDB with encrypted email storage
- **Responsive Design**: All components should be mobile-friendly
- **Error Handling**: Always include proper error boundaries
- **Type Safety**: Use TypeScript interfaces for all data structures

## Debugging
- Debug routes available under `/debug/` for development
- Console logging is extensive for troubleshooting
- Auth debug component available for session testing

This overview should be referenced when making changes to ensure consistency with the existing architecture and patterns.
