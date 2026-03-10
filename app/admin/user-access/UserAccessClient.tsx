//app/admin/user-access/UserAccessClient.tsx
"use client";

import { useState } from 'react';
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { updateUserFlag } from '@/app/actions/userActions';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Loader2, Shield, Settings, User, Store, RefreshCw, Sparkles } from 'lucide-react';

// Define the full user type with all the new fields
type UserType = {
  _id: string;
  username: string;
  email: string;
  roles: {
    isAdmin?: boolean;
    canManageLocations?: boolean;
    canImportCardCollections?: boolean;
    isSuperAdmin?: boolean;
    isContentCreator?: boolean;
    isCurator?: boolean;
  };
  isLocalGamingStore?: boolean;
  isMetafySupporter?: boolean;
  isShop?: boolean;
  isTcgSeller?: boolean;
};

interface RoleSwitchProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled: boolean;
}

const RoleSwitch = ({ 
  id, 
  label, 
  description, 
  checked, 
  onCheckedChange, 
  disabled 
}: RoleSwitchProps) => (
  <div className={`
    flex items-center justify-between space-x-3 rounded-lg p-4 transition-all duration-200
    ${checked 
      ? 'bg-primary/10 border-2 border-primary/30 hover:bg-primary/15' 
      : 'bg-muted/30 border-2 border-muted hover:bg-muted/50'
    }
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
  `}>
    <div className="flex-1 space-y-1">
      <Label 
        htmlFor={id} 
        className={`text-sm font-medium leading-none cursor-pointer ${
          checked ? 'text-primary' : 'text-foreground'
        } ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}
      >
        {label}
      </Label>
      {description && (
        <p className={`text-xs ${
          checked ? 'text-primary/80' : 'text-muted-foreground'
        }`}>
          {description}
        </p>
      )}
    </div>
    <div className="flex items-center">
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/30"
      />
    </div>
  </div>
);

const SectionHeader = ({ 
  icon: Icon, 
  title, 
  count 
}: { 
  icon: any; 
  title: string; 
  count?: number;
}) => (
  <div className="flex items-center justify-between mb-4 pb-2 border-b border-border/50">
    <div className="flex items-center gap-2">
      <div className="p-1.5 rounded-md bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <h4 className="font-semibold text-sm text-foreground">{title}</h4>
    </div>
    {count !== undefined && count > 0 && (
      <Badge variant="outline" className="h-6 px-2 text-xs font-medium border-primary/30 text-primary bg-primary/5">
        {count} active
      </Badge>
    )}
  </div>
);

export function UserAccessClient({ initialUsers }: { initialUsers: UserType[] }) {
  const [users, setUsers] = useState<UserType[]>(initialUsers);
  const [saving, setSaving] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  async function handleFlagChange(userId: string, field: string, value: boolean) {
    setSaving(`${userId}-${field}`);
    const originalUsers = [...users];
    
    // Optimistic update
    setUsers(prev => prev.map(u => {
      if (u._id === userId) {
        const updatedUser = { ...u };
        const keys = field.split('.');
        if (keys.length > 1) {
          updatedUser.roles = { ...updatedUser.roles, [keys[1]]: value };
        } else {
          (updatedUser as any)[keys[0]] = value;
        }
        return updatedUser;
      }
      return u;
    }));
    
    const result = await updateUserFlag(userId, field, value);

    if (result.success) {
      toast({ 
        title: "Success", 
        description: `Updated ${field.replace('roles.', '')} for ${users.find(u => u._id === userId)?.username}.`,
        duration: 3000
      });
    } else {
      toast({ 
        title: "Error", 
        description: result.message, 
        variant: "destructive",
        duration: 5000
      });
      setUsers(originalUsers); // Revert on failure
    }

    setSaving(null);
  }

  const getActiveRolesCount = (user: UserType) => {
    const roleCount = Object.values(user.roles || {}).filter(Boolean).length;
    const flagCount = [user.isMetafySupporter, user.isShop, user.isTcgSeller, user.isLocalGamingStore]
      .filter(Boolean).length;
    return roleCount + flagCount;
  };

  const isFieldSaving = (userId: string, field: string) =>
    saving === `${userId}-${field}`;

  async function handleRefreshFeaturedCards() {
    setRefreshing(true);
    try {
      const response = await fetch('/api/admin/refresh-featured-cards', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: "Success!",
          description: `Featured cards refreshed! Updated ${data.data?.cardsRefreshed || 0} cards in ${data.data?.processingTimeSeconds || 0}s.`,
          duration: 5000,
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to refresh featured cards",
          variant: "destructive",
          duration: 5000,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Network error - please try again",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">User Access Management</h2>
          <p className="text-muted-foreground">
            Manage user roles and permissions across the platform
          </p>
        </div>
        <Badge variant="outline" className="px-3 py-1">
          {users.length} {users.length === 1 ? 'User' : 'Users'}
        </Badge>
      </div>

      {/* Featured Cards Management Section */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Featured Cards Cache</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Manually refresh the homepage featured cards (normally updates every 12 hours)
                </p>
              </div>
            </div>
            <Button
              onClick={handleRefreshFeaturedCards}
              disabled={refreshing}
              className="bg-primary hover:bg-primary/90"
            >
              {refreshing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Now
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {users.map((user) => {
          const activeRoles = getActiveRolesCount(user);
          
          return (
            <Card key={user._id} className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-2 border-border/50 shadow-lg hover:shadow-xl hover:border-border transition-all duration-200">
              {saving?.startsWith(user._id) && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-md z-10 flex items-center justify-center border-2 border-primary/50 rounded-lg">
                  <div className="flex items-center gap-3 text-sm text-foreground bg-card/90 px-4 py-2 rounded-full shadow-lg border border-border">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="font-medium">Updating permissions...</span>
                  </div>
                </div>
              )}
              
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-semibold text-foreground">
                      {user.username}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  {activeRoles > 0 && (
                    <Badge 
                      variant={user.roles?.isSuperAdmin ? "destructive" : user.roles?.isAdmin ? "default" : "secondary"}
                      className="px-3 py-1 font-medium shadow-sm"
                    >
                      {activeRoles} role{activeRoles !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-8 p-6">
                {/* Admin Roles */}
                <div>
                  <SectionHeader 
                    icon={Shield} 
                    title="Admin Roles" 
                    count={Object.values(user.roles || {}).filter(Boolean).length}
                  />
                  <div className="space-y-3">
                    <RoleSwitch 
                      id={`${user._id}-isAdmin`} 
                      label="Administrator" 
                      description="Full admin access to the platform"
                      checked={!!user.roles?.isAdmin} 
                      disabled={!!saving}
                      onCheckedChange={(v) => handleFlagChange(user._id, 'roles.isAdmin', v)} 
                    />
                    <RoleSwitch 
                      id={`${user._id}-isSuperAdmin`} 
                      label="Super Administrator" 
                      description="Ultimate platform control and access"
                      checked={!!user.roles?.isSuperAdmin} 
                      disabled={!!saving}
                      onCheckedChange={(v) => handleFlagChange(user._id, 'roles.isSuperAdmin', v)} 
                    />
                  </div>
                </div>
                
                {/* Permissions */}
                <div>
                  <SectionHeader 
                    icon={Settings} 
                    title="Permissions"
                    count={[user.roles?.canManageLocations, user.roles?.canImportCardCollections, user.roles?.isContentCreator, user.roles?.isCurator].filter(Boolean).length}
                  />
                  <div className="space-y-3">
                  <RoleSwitch 
                      id={`${user._id}-isContentCreator`} 
                      label="Content Creator" 
                      description="Can create new articles and edit their own."
                      checked={!!user.roles?.isContentCreator} 
                      disabled={!!saving}
                      onCheckedChange={(v) => handleFlagChange(user._id, 'roles.isContentCreator', v)} 
                    />
                    <RoleSwitch 
                      id={`${user._id}-canManageLocations`} 
                      label="Manage Locations" 
                      description="Can create and edit store locations"
                      checked={!!user.roles?.canManageLocations} 
                      disabled={!!saving}
                      onCheckedChange={(v) => handleFlagChange(user._id, 'roles.canManageLocations', v)} 
                    />
                    <RoleSwitch
                      id={`${user._id}-canImport`}
                      label="Import Collections"
                      description="Can import card collection data"
                      checked={!!user.roles?.canImportCardCollections}
                      disabled={!!saving}
                      onCheckedChange={(v) => handleFlagChange(user._id, 'roles.canImportCardCollections', v)}
                    />
                    <RoleSwitch
                      id={`${user._id}-isCurator`}
                      label="Curator"
                      description="Can manage curated card lists for the deck editor"
                      checked={!!user.roles?.isCurator}
                      disabled={!!saving}
                      onCheckedChange={(v) => handleFlagChange(user._id, 'roles.isCurator', v)}
                    />
                  </div>
                </div>

                {/* User Flags */}
                <div>
                  <SectionHeader 
                    icon={Store} 
                    title="User Types"
                    count={[user.isMetafySupporter, user.isShop, user.isTcgSeller, user.isLocalGamingStore].filter(Boolean).length}
                  />
                  <div className="space-y-3">
                    <RoleSwitch
                      id={`${user._id}-isMetafySupporter`}
                      label="Metafy Supporter"
                      description="Has active Metafy supporter status"
                      checked={!!user.isMetafySupporter}
                      disabled={!!saving}
                      onCheckedChange={(v) => handleFlagChange(user._id, 'isMetafySupporter', v)}
                    />
                    <RoleSwitch 
                      id={`${user._id}-isShop`} 
                      label="Shop Owner" 
                      description="Operates an online card shop"
                      checked={!!user.isShop} 
                      disabled={!!saving}
                      onCheckedChange={(v) => handleFlagChange(user._id, 'isShop', v)} 
                    />
                    <RoleSwitch 
                      id={`${user._id}-isTcgSeller`} 
                      label="TCG Seller" 
                      description="Authorized to sell trading cards"
                      checked={!!user.isTcgSeller} 
                      disabled={!!saving}
                      onCheckedChange={(v) => handleFlagChange(user._id, 'isTcgSeller', v)} 
                    />
                    <RoleSwitch 
                      id={`${user._id}-isLGS`} 
                      label="Local Game Store" 
                      description="Operates a physical game store"
                      checked={!!user.isLocalGamingStore} 
                      disabled={!!saving}
                      onCheckedChange={(v) => handleFlagChange(user._id, 'isLocalGamingStore', v)} 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}