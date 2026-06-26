"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
    Package,
    Users,
    ShoppingCart,
    BarChart3,
    Settings,
    LogOut,
    Menu,
    X,
    Search,
    Edit,
    Trash2,
    Save,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

const navItems = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/products", label: "จัดการสินค้า", icon: Package },
  { href: "/admin/orders", label: "คำสั่งซื้อ", icon: ShoppingCart },
  { href: "/admin/users", label: "จัดการผู้ใช้", icon: Users },
  { href: "/admin/settings", label: "ตั้งค่า", icon: Settings },
]

const roles = [
    { value: "customer", label: "Customer", color: "bg-gray-100 text-gray-800" },
    { value: "admin", label: "Admin", color: "bg-purple-100 text-purple-800" },
    { value: "staff", label: "Staff", color: "bg-blue-100 text-blue-800" },
]

const statuses = [
    { value: true, label: "ใช้งาน", color: "bg-green-100 text-green-800" },
    { value: false, label: "ปิดใช้งาน", color: "bg-red-100 text-red-800" },
]

type User = {
    id: number
    username: string
    email: string
    first_name: string
    last_name: string
    phone: string | null
    role: string
    is_active: boolean
    created_at: string
}

const API_BASE_URL = "http://localhost:5000"

export default function AdminUsersPage() {
    const router = useRouter()

    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [isAdmin, setIsAdmin] = useState(false)

    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)

    const [searchTerm, setSearchTerm] = useState("")
    const [roleFilter] = useState("all")

    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [selectedUser, setSelectedUser] = useState<User | null>(null)

    useEffect(() => {
        const user = localStorage.getItem("user")

        if (user) {
            const parsed = JSON.parse(user)

            if (parsed.role === "admin" || parsed.role === "staff") {
                setIsAdmin(true)
                fetchUsers()
            } else {
                router.push("/login")
            }
        } else {
            router.push("/login")
        }
    }, [router])

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem("token")
            const res = await fetch(`${API_BASE_URL}/users`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            })
            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || "Load users failed")
            }

            setUsers(data)
        } catch (error) {
            console.error("โหลด users ไม่สำเร็จ", error)
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = () => {
        localStorage.removeItem("user")
        localStorage.removeItem("token")
        router.push("/login")
    }

    const filteredUsers = users.filter((u) => {
        const fullName = `${u.first_name || ""} ${u.last_name || ""}`

        const matchesSearch =
            fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.username.toLowerCase().includes(searchTerm.toLowerCase())

        const matchesRole =
            roleFilter === "all" || u.role === roleFilter

        return matchesSearch && matchesRole
    })

    const handleDeleteUser = async (id: number) => {
        if (!confirm("คุณต้องการลบผู้ใช้นี้หรือไม่?")) return

        try {
            const token = localStorage.getItem("token")
            const res = await fetch(`${API_BASE_URL}/users/${id}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || "Delete user failed")
            }

            setUsers(users.filter((u) => u.id !== id))

            if (selectedUser?.id === id) {
                setSelectedUser(null)
            }
        } catch (error) {
            console.error(error)
        }
    }

    const handleSaveEdit = async () => {
        if (!editingUser) return

        try {
            const token = localStorage.getItem("token")
            const res = await fetch(`${API_BASE_URL}/users/${editingUser.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    username: editingUser.username,
                    email: editingUser.email,
                    first_name: editingUser.first_name,
                    last_name: editingUser.last_name,
                    phone: editingUser.phone,
                    role: editingUser.role,
                    is_active: editingUser.is_active,
                }),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || "Update user failed")
            }

            fetchUsers()
            setEditingUser(null)
        } catch (error) {
            console.error(error)
        }
    }

    const getRoleColor = (role: string) => {
        return (
            roles.find((r) => r.value === role)?.color ||
            "bg-gray-100 text-gray-800"
        )
    }

    const getStatusColor = (status: boolean) => {
        return (
            statuses.find((s) => s.value === status)?.color ||
            "bg-gray-100 text-gray-800"
        )
    }

    const getRoleLabel = (role: string) => {
        return (
            roles.find((r) => r.value === role)?.label || role
        )
    }

    const getStatusLabel = (status: boolean) => {
        return (
            statuses.find((s) => s.value === status)?.label || "Unknown"
        )
    }

    if (!isAdmin || loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#f5f1ed]">
                <div className="text-center">
                    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#8b5e3c] border-t-transparent"></div>
                    <p className="mt-4 text-[#5b3a29]">
                        กำลังโหลด...
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen bg-[#f5f1ed]">
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-[#5b3a29] text-white transition-transform duration-300 lg:static lg:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
                    }`}
            >
                <div className="flex h-full flex-col">
                    <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
                        <Link href="/admin" className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#8b5e3c]">
                                <span className="font-bold text-white">
                                    L
                                </span>
                            </div>

                            <div>
                                <p className="text-lg font-semibold">
                                    BosButter
                                </p>

                                <p className="text-xs text-white/60">
                                    Admin Panel
                                </p>
                            </div>
                        </Link>

                        <button className="lg:hidden" onClick={() => setIsSidebarOpen(false)}>
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <nav className="flex-1 space-y-2 p-4">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${item.href === "/admin/users"
                                        ? "bg-[#8b5e3c] text-white"
                                        : "text-white/70 hover:bg-white/10 hover:text-white"
                                    }`}
                            >
                                <item.icon className="h-5 w-5" />
                                {item.label}
                            </Link>
                        ))}
                    </nav>

                    <div className="border-t border-white/10 p-4">
                        <Button
                            variant="ghost"
                            className="w-full justify-start gap-2 text-white hover:bg-white/10"
                            onClick={handleLogout}
                        >
                            <LogOut className="h-4 w-4" />
                            ออกจากระบบ
                        </Button>
                    </div>
                </div>
            </aside>

            {/* Main */}
            <div className="flex flex-1 flex-col">
                <header className="sticky top-0 z-30 flex h-16 items-center border-b border-[#e6ddd4] bg-white px-4 lg:px-6">
                    <button
                        className="mr-4 lg:hidden"
                        onClick={() => setIsSidebarOpen(true)}
                    >
                        <Menu className="h-6 w-6 text-[#5b3a29]" />
                    </button>

                    <div className="flex-1">
                        <h1 className="text-xl font-bold text-[#5b3a29]">
                            จัดการผู้ใช้
                        </h1>
                    </div>
                </header>

                <main className="flex-1 p-4 lg:p-6">
                    {/* Search */}
                    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative flex-1 sm:max-w-xs">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b5e3c]" />

                            <Input
                                placeholder="ค้นหาผู้ใช้..."
                                className="border-[#d6c4b8] bg-white pl-10 text-[#2f2118] placeholder:text-[#8b735f]"
                                value={searchTerm}
                                onChange={(e) =>
                                    setSearchTerm(e.target.value)
                                }
                            />
                        </div>
                    </div>

                    {/* Edit User Form */}
                    {editingUser && (
                        <Card className="mb-6">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2">
                                        <Edit className="h-5 w-5" />
                                        แก้ไขผู้ใช้
                                    </CardTitle>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setEditingUser(null)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>

                            <CardContent>
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                    {/* Username */}
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-foreground">
                                            Username
                                        </label>

                                        <Input
                                            disabled
                                            value={editingUser.username}
                                        />
                                    </div>

                                    {/* Email */}
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-foreground">
                                            อีเมล
                                        </label>

                                        <Input
                                            disabled
                                            value={editingUser.email}
                                        />
                                    </div>

                                    {/* Role */}
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-foreground">
                                            Role
                                        </label>

                                        <select
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                            value={editingUser.role}
                                            onChange={(e) =>
                                                setEditingUser({
                                                    ...editingUser,
                                                    role: e.target.value,
                                                })
                                            }
                                        >
                                            {roles.map((role) => (
                                                <option
                                                    key={role.value}
                                                    value={role.value}
                                                >
                                                    {role.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Status */}
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-foreground">
                                            สถานะ
                                        </label>

                                        <select
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                            value={editingUser.is_active ? "true" : "false"}
                                            onChange={(e) =>
                                                setEditingUser({
                                                    ...editingUser,
                                                    is_active: e.target.value === "true",
                                                })
                                            }
                                        >
                                            <option value="true">ใช้งาน</option>
                                            <option value="false">ปิดใช้งาน</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="mt-4 flex justify-end gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setEditingUser(null)}
                                    >
                                        ยกเลิก
                                    </Button>

                                    <Button
                                        onClick={handleSaveEdit}
                                        className="gap-2"
                                    >
                                        <Save className="h-4 w-4" />
                                        บันทึก
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Table */}
                    <Card className="border-[#e6ddd4] bg-white text-[#2f2118]">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-[#e6ddd4] bg-[#f5f1ed] text-[#5b3a29]">
                                            <th className="px-4 py-3 text-left text-sm font-semibold">
                                                ผู้ใช้
                                            </th>

                                            <th className="px-4 py-3 text-left text-sm font-semibold">
                                                Role
                                            </th>

                                            <th className="px-4 py-3 text-left text-sm font-semibold">
                                                สถานะ
                                            </th>

                                            <th className="px-4 py-3 text-left text-sm font-semibold">
                                                วันที่สมัคร
                                            </th>

                                            <th className="px-4 py-3 text-left text-sm font-semibold">
                                                การจัดการ
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {filteredUsers.map((user) => (
                                            <tr
                                                key={user.id}
                                                className="border-b border-[#eee4dc] text-[#2f2118] hover:bg-[#faf8f6]"
                                            >
                                                <td className="px-4 py-3">
                                                    <div>
                                                        <p className="font-medium text-[#2f2118]">
                                                            {user.first_name || user.last_name
                                                                ? `${user.first_name} ${user.last_name}`
                                                                : user.username}
                                                        </p>

                                                        <p className="text-sm text-[#6f5a49]">
                                                            {user.email}
                                                        </p>
                                                    </div>
                                                </td>

                                                <td className="px-4 py-3">
                                                    <span
                                                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getRoleColor(
                                                            user.role
                                                        )}`}
                                                    >
                                                        {getRoleLabel(user.role)}
                                                    </span>
                                                </td>

                                                <td className="px-4 py-3">
                                                    <span
                                                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(
                                                            user.is_active
                                                        )}`}
                                                    >
                                                        {getStatusLabel(user.is_active)}
                                                    </span>
                                                </td>

                                                <td className="px-4 py-3 text-sm text-[#5b3a29]">
                                                    {new Date(
                                                        user.created_at
                                                    ).toLocaleDateString("th-TH")}
                                                </td>

                                                <td className="px-4 py-3">
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-[#5b3a29] hover:bg-[#f5f1ed]"
                                                            onClick={() =>
                                                                setEditingUser(user)
                                                            }
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>

                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-red-700 hover:bg-red-50"
                                                            onClick={() =>
                                                                handleDeleteUser(user.id)
                                                            }
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </main>
            </div>
        </div>
    )
}
