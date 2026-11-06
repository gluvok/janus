"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AccountDialog } from "@/components/account-dialog";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Logout01Icon,
  Notification01Icon,
  Sorting05Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { type User } from "@/app/users/types";

export type UserProps = {
  name: string;
  username: string;
  avatar?: string;
  initials: string;
};

export interface NavUserProps {
  user: UserProps;
  accountUser: User | null;
  onUserUpdated: (user: User) => void;
}

export function UserAvatarInfo({ user }: { user: UserProps }) {
  return (
    <>
      <Avatar>
        {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
        <AvatarFallback className="font-medium text-xs">{user.initials}</AvatarFallback>
      </Avatar>
      <div className="grid flex-1 leading-tight">
        <span className="truncate font-semibold">{user.name}</span>
        <span className="truncate text-xs text-muted-foreground">@{user.username}</span>
      </div>
    </>
  );
}

export function NavUser({ user, accountUser, onUserUpdated }: NavUserProps) {
  const router = useRouter();
  const { isMobile } = useSidebar();
  const [isAccountOpen, setIsAccountOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await axios.post("/api/auth/logout");
    } finally {
      router.replace("/login");
      router.refresh();
    }
  };

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
              <UserAvatarInfo user={user} />
              <HugeiconsIcon icon={Sorting05Icon} />
            </DropdownMenuTrigger>
            <DropdownMenuContent side={isMobile ? "bottom" : "right"}>
              <DropdownMenuGroup>
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <UserAvatarInfo user={user} />
                </div>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => setIsAccountOpen(true)}>
                  <HugeiconsIcon icon={UserCircleIcon} />
                  <span>Account</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <HugeiconsIcon icon={Notification01Icon} />
                  <span>Notifications</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                <HugeiconsIcon icon={Logout01Icon} />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <AccountDialog
        open={isAccountOpen}
        onOpenChange={setIsAccountOpen}
        user={accountUser}
        onUserUpdated={onUserUpdated}
      />
    </>
  );
}
