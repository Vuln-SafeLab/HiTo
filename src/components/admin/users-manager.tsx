"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FieldError } from "@/components/setup/field-error";
import { createUserAction, updateUserAction } from "@/lib/actions/users";
import { userFormSchema, type UserFormInput } from "@/lib/validators/content";
import type { AdminUserItem } from "./types";
import { errorKeyFor } from "./utils";

interface UsersManagerProps {
  users: AdminUserItem[];
  currentUserId: string;
}

export function UsersManager({ users, currentUserId }: UsersManagerProps) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const [editing, setEditing] = useState<AdminUserItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("admin.nav.users")}</h1>
        <Button
          variant="gradient"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          {t("admin.users.new")}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("common.username")}</TableHead>
            <TableHead>{t("common.email")}</TableHead>
            <TableHead>{t("common.role")}</TableHead>
            <TableHead>{t("common.status")}</TableHead>
            <TableHead>{t("admin.security.time")}</TableHead>
            <TableHead className="w-14 text-right">{t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">
                {user.username}
                {user.id === currentUserId && (
                  <span className="ms-2 text-xs text-faint">
                    ({t("admin.security.current")})
                  </span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">{user.email}</TableCell>
              <TableCell>
                <Badge variant={user.role === "ADMIN" ? "default" : "outline"}>
                  {user.role === "ADMIN"
                    ? t("admin.users.roleAdmin")
                    : t("admin.users.roleEditor")}
                </Badge>
              </TableCell>
              <TableCell>
                {user.isActive ? (
                  <Badge variant="success">{t("admin.users.active")}</Badge>
                ) : (
                  <Badge variant="destructive">{t("admin.users.inactive")}</Badge>
                )}
              </TableCell>
              <TableCell className="text-xs tabular-nums text-faint">
                {format.dateTime(new Date(user.createdAt), { dateStyle: "medium" })}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("admin.users.edit")}
                  onClick={() => {
                    setEditing(user);
                    setFormOpen(true);
                  }}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <UserFormDialog
        open={formOpen}
        user={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}

interface UserFormDialogProps {
  open: boolean;
  user: AdminUserItem | null;
  onClose: () => void;
  onSaved: () => void;
}

function UserFormDialog({ open, user, onClose, onSaved }: UserFormDialogProps) {
  const t = useTranslations();
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const schema = useMemo(() => userFormSchema((key, values) => t(key, values)), [t]);
  const form = useForm<UserFormInput>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", email: "", role: "EDITOR", isActive: true, password: "" },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      username: user?.username ?? "",
      email: user?.email ?? "",
      role: user?.role ?? "EDITOR",
      isActive: user?.isActive ?? true,
      password: "",
    });
    setErrorKey(null);
  }, [open, user, form]);

  async function submit(values: UserFormInput): Promise<void> {
    if (user === null && values.password === "") {
      form.setError("password", { message: t("validation.required") });
      return;
    }
    setSubmitting(true);
    setErrorKey(null);
    const outcome =
      user === null ? await createUserAction(values) : await updateUserAction(user.id, values);
    setSubmitting(false);
    if (outcome.ok) {
      toast.success(t("common.saved"));
      onSaved();
    } else {
      setErrorKey(errorKeyFor(outcome.code));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {user === null ? t("admin.users.new") : t("admin.users.edit")}
          </DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => void form.handleSubmit(submit)(event)}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="user-name">{t("common.username")}</Label>
              <Input
                id="user-name"
                disabled={user !== null}
                autoComplete="off"
                {...form.register("username")}
              />
              <FieldError message={form.formState.errors.username?.message} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="user-email">{t("common.email")}</Label>
              <Input id="user-email" type="email" autoComplete="off" {...form.register("email")} />
              <FieldError message={form.formState.errors.email?.message} />
            </div>
          </div>

          <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>{t("common.role")}</Label>
              <Select
                value={form.watch("role")}
                onValueChange={(value) =>
                  form.setValue("role", value === "ADMIN" ? "ADMIN" : "EDITOR", {
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">{t("admin.users.roleAdmin")}</SelectItem>
                  <SelectItem value="EDITOR">{t("admin.users.roleEditor")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex h-9 items-center gap-3 text-sm">
              <Switch
                checked={form.watch("isActive")}
                onCheckedChange={(checked) =>
                  form.setValue("isActive", checked, { shouldDirty: true })
                }
              />
              {t("admin.users.active")}
            </label>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-password">
              {user === null
                ? t("common.password")
                : `${t("admin.users.resetPassword")} (${t("common.optional")})`}
            </Label>
            <Input
              id="user-password"
              type="password"
              autoComplete="new-password"
              {...form.register("password")}
            />
            <FieldError message={form.formState.errors.password?.message} />
          </div>

          {errorKey !== null && (
            <p role="alert" className="text-sm text-destructive">
              {t(errorKey)}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="gradient" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {submitting ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
