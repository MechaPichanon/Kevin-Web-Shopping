"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import Navbarsub from "@/components/navbarsub";
export default function ProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const token = getToken();

        if (!token) {
            router.push("/login");
            return;
        }

        fetch("http://localhost:5000/profile", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    router.push("/login");
                } else {
                    setUser(data);
                }
            });
    }, []);

    if (!user) return <p>Loading...</p>;

    return (
            <div style={{ maxWidth: 400, margin: "100px auto" }}>

                <h1>Profile</h1>
                <p><b>Username:</b> {user.username}</p>
                <p><b>Email:</b> {user.email}</p>
            </div>
    );
}
