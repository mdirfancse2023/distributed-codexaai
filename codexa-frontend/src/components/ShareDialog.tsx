import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { api, getUserInfo } from "@/lib/api";
import { ProjectMember, ProjectRole } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

interface ShareDialogProps {
    projectId: string;
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function ShareDialog({ projectId, trigger, open, onOpenChange }: ShareDialogProps) {
    const { toast } = useToast();
    const currentUser = getUserInfo();
    const [members, setMembers] = useState<ProjectMember[]>([]);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState<ProjectRole>("EDITOR");
    const [loading, setLoading] = useState(false);
    const [internalOpen, setInternalOpen] = useState(false);

    const memberCacheKey = `share-member-cache:${projectId}`;

    const readMemberCache = (): Record<string, { username?: string; name?: string }> => {
        try {
            const rawCache = localStorage.getItem(memberCacheKey);
            return rawCache ? JSON.parse(rawCache) : {};
        } catch {
            return {};
        }
    };

    const writeMemberCache = (entries: Record<string, { username?: string; name?: string }>) => {
        try {
            localStorage.setItem(memberCacheKey, JSON.stringify(entries));
        } catch {
            // Ignore local cache write failures.
        }
    };

    const mergeMemberCache = (incomingMembers: ProjectMember[]) => {
        const cache = readMemberCache();

        return incomingMembers.map((member) => {
            const cachedMember = cache[String(member.userId)] || {};

            return {
                ...member,
                username: member.username?.trim() || cachedMember.username || "",
                name: member.name?.trim() || cachedMember.name || "",
            };
        });
    };

    const cacheMembers = (incomingMembers: ProjectMember[]) => {
        const nextCache = { ...readMemberCache() };

        incomingMembers.forEach((member) => {
            const username = member.username?.trim();
            const name = member.name?.trim();

            if (username || name) {
                nextCache[String(member.userId)] = {
                    username: username || nextCache[String(member.userId)]?.username || "",
                    name: name || nextCache[String(member.userId)]?.name || "",
                };
            }
        });

        writeMemberCache(nextCache);
    };

    const getMemberLabel = (member: ProjectMember) => {
        const fallbackUsername = typeof member.username === "string" ? member.username.trim() : "";
        const fallbackName = typeof member.name === "string" ? member.name.trim() : "";
        const fallbackRole = member.role ?? "VIEWER";

        const roleFallbacks: Record<ProjectRole, { displayName: string; secondaryText: string; initials: string }> = {
            OWNER: {
                displayName: "Project owner",
                secondaryText: "Owner account",
                initials: "OW",
            },
            EDITOR: {
                displayName: "Project editor",
                secondaryText: "Editor access",
                initials: "ED",
            },
            VIEWER: {
                displayName: "Project viewer",
                secondaryText: "Viewer access",
                initials: "VW",
            },
        };
        const roleFallback = roleFallbacks[fallbackRole];

        return {
            displayName: fallbackName || fallbackUsername || roleFallback.displayName,
            secondaryText: fallbackUsername || roleFallback.secondaryText,
            initials: (fallbackName || fallbackUsername || roleFallback.initials).slice(0, 2).toUpperCase(),
            role: fallbackRole,
        };
    };

    const visibleMembers = (() => {
        const normalizedMembers = members.map((member) => {
            if (currentUser && member.userId === currentUser.id) {
                return {
                    ...member,
                    username: member.username?.trim() || currentUser.username,
                    name: member.name?.trim() || currentUser.name,
                    role: member.role ?? "OWNER",
                };
            }

            return {
                ...member,
                username: member.username?.trim() || "",
                name: member.name?.trim() || "",
                role: member.role ?? "VIEWER",
            };
        });

        if (normalizedMembers.length > 0) {
            return normalizedMembers;
        }

        if (currentUser) {
            return [{
                userId: currentUser.id,
                username: currentUser.username,
                name: currentUser.name,
                role: "OWNER" as ProjectRole,
            }];
        }

        return [];
    })();

    // Helper function to get role display text
    const getRoleDisplayText = (role: ProjectRole): string => {
        switch (role) {
            case 'OWNER':
                return 'Owner';
            case 'EDITOR':
                return 'Can edit';
            case 'VIEWER':
                return 'Can view';
            default:
                return role;
        }
    };

    // Use controlled open state if provided, otherwise use internal state
    const isOpen = open !== undefined ? open : internalOpen;
    const handleOpenChange = (newOpen: boolean) => {
        if (onOpenChange) {
            onOpenChange(newOpen);
        } else {
            setInternalOpen(newOpen);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadMembers();
        }
    }, [isOpen, projectId]);

    const loadMembers = async () => {
        try {
            const data = await api.getProjectMembers(projectId);
            const mergedMembers = mergeMemberCache(Array.isArray(data) ? data : []);
            cacheMembers(mergedMembers);
            setMembers(mergedMembers);
        } catch (error) {
            // Fail silently or show placeholder if valid "mock" experience is needed
            console.error("Failed to load members", error);
            setMembers([]);
        }
    };

    const handleInvite = async () => {
        if (!inviteEmail.trim()) return;
        setLoading(true);
        try {
            const invitedMember = await api.inviteMember(projectId, inviteEmail, inviteRole);
            if (invitedMember?.userId) {
                const mergedInvitedMember = mergeMemberCache([{
                    ...invitedMember,
                    username: invitedMember.username?.trim() || inviteEmail.trim(),
                }])[0];

                cacheMembers([mergedInvitedMember]);
                setMembers((currentMembers) => {
                    const withoutExisting = currentMembers.filter((member) => member.userId !== mergedInvitedMember.userId);
                    return [...withoutExisting, mergedInvitedMember];
                });
            }
            toast({ title: "Invite sent", description: `Invited ${inviteEmail} to the project.` });
            setInviteEmail("");
            loadMembers();
        } catch (error) {
            console.error(error);
            toast({ title: "Failed to invite", description: "Could not send invitation.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (userId: number, newRole: ProjectRole) => {
        try {
            await api.updateMemberRole(projectId, userId, newRole);
            setMembers((currentMembers) => currentMembers.map((member) => (
                member.userId === userId ? { ...member, role: newRole } : member
            )));
            toast({ title: "Role updated" });
        } catch (error) {
            toast({ title: "Error", description: "Failed to update role.", variant: "destructive" });
        }
    };

    const handleRemoveMember = async (userId: number) => {
        try {
            await api.removeMember(projectId, userId);
            setMembers((currentMembers) => currentMembers.filter((member) => member.userId !== userId));
            toast({ title: "Member removed" });
        } catch (error) {
            toast({ title: "Error", description: "Failed to remove member.", variant: "destructive" });
        }
    };

    return (
        <Popover open={isOpen} onOpenChange={handleOpenChange}>
            {trigger && <PopoverTrigger asChild>{trigger}</PopoverTrigger>}
            <PopoverContent align="start" side="bottom" sideOffset={8} className="w-[min(20rem,calc(100vw-1rem))] p-0">
                <div className="p-3.5 sm:p-4">
                    <div className="mb-4">
                        <h2 className="text-base font-semibold">Share project</h2>
                        <p className="text-xs text-muted-foreground">
                            Invite collaborators and manage access from this project.
                        </p>
                    </div>

                    {/* Invite Section */}
                    <div className="space-y-3 mb-6">
                        <div className="flex gap-2">
                            <Input
                                placeholder="Email or username"
                                className="flex-1 bg-muted/50 border-input/50"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                            />
                            <Button
                                onClick={handleInvite}
                                disabled={!inviteEmail.trim() || loading}
                                className="px-6"
                            >
                                Invite
                            </Button>
                        </div>
                        <Select value={inviteRole} onValueChange={(val) => setInviteRole(val as ProjectRole)}>
                            <SelectTrigger className="w-full bg-muted/50 border-input/50">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="VIEWER">Can view</SelectItem>
                                <SelectItem value="EDITOR">Can edit</SelectItem>
                                <SelectItem value="OWNER">Owner</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Members List */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-medium text-muted-foreground">People with access</h4>

                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                            {visibleMembers.length === 0 && (
                                <div className="rounded-lg bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                                    No members available yet.
                                </div>
                            )}

                            {visibleMembers.map(member => {
                                const memberLabel = getMemberLabel(member);
                                const isCurrentUser = currentUser?.id === member.userId;

                                return (
                                <div key={member.userId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                                    <Avatar className="h-9 w-9">
                                        <AvatarFallback className="text-xs font-medium">
                                            {memberLabel.initials}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0 text-sm">
                                        <div className="font-medium truncate">{isCurrentUser ? "You" : memberLabel.displayName}</div>
                                        <div className="text-xs text-muted-foreground truncate">{memberLabel.secondaryText}</div>
                                    </div>

                                    {memberLabel.role === 'OWNER' ? (
                                        <span className="text-xs text-muted-foreground px-2 whitespace-nowrap">Owner</span>
                                    ) : (
                                        <Select
                                            value={memberLabel.role}
                                            onValueChange={(val) => {
                                                if (val === 'REMOVE') handleRemoveMember(member.userId);
                                                else handleRoleChange(member.userId, val as ProjectRole);
                                            }}
                                        >
                                            <SelectTrigger className="h-8 w-[100px] text-xs border-none bg-transparent hover:bg-muted focus:ring-1 shadow-none">
                                                <SelectValue placeholder={getRoleDisplayText(memberLabel.role)} />
                                            </SelectTrigger>
                                            <SelectContent align="end">
                                                <SelectItem value="EDITOR">Can edit</SelectItem>
                                                <SelectItem value="VIEWER">Can view</SelectItem>
                                                <SelectItem value="REMOVE" className="text-destructive focus:text-destructive">Remove</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>
                            )})}
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
