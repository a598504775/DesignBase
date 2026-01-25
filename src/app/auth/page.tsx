'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthPage() {

    const [account, setAccount] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const router = useRouter();

    const onClickLogin = () => {
        if (account === "admin" && password === "123") {
            router.push("/projects");
        } else {
            setError("Account or password incorrect");
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="flex flex-col gap-6 w-[420px] items-center">
                <h1 className="text-3xl font-semibold text=center">Design Base</h1>
                <div className="flex items-center gap-3">
                    <span className="w-20 text-right">Account: </span>
                    <input
                        className="flex-1 h-10 border rounded px-3"
                        placeholder="Account"
                        value={account}
                        onChange={(e) => setAccount(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-3">
                    <span className="w-20 text-right">Password: </span>
                    <input
                        className="flex-1 h-10 border rounded px-3"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>
                <button 
                    onClick={onClickLogin}
                    className="h-10 bg-black text-white font-semibold rounded px-3 hover:bg-gray-800 transition-colors duration-200"
                >
                    Login
                </button>
                {!!error && (
                    <div>
                        {error}
                    </div>
                )}
            </div>
        </div>
    )
}