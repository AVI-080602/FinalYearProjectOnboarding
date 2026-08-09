'use client';

import { useState } from "react";
import { categoryOptions } from "@/lib/quiet-space-category";
import Link from "next/link";

export default function Page() {

    const [formData, setFormData] = useState({
        name: "",
        category: "",
        address: "",
    });

    const [successMsg, setSuccessMsg] = useState("");

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const newSuggestion = {
            id: crypto.randomUUID(),
            name: formData.name,
            category: formData.category,
            address: formData.address,
            status: "pending",
            date: new Date().toISOString(),
        }

        const existingSuggestions = JSON.parse(localStorage.getItem("calmSpaceSuggestions") || "[]");
        localStorage.setItem(
        "calmSpaceSuggestions",
        JSON.stringify([...existingSuggestions, newSuggestion])
        );
        
        setSuccessMsg("Calm space added successfully!");

        setFormData({
            name: "",
            category: "",
            address: "",
        });
    }

    return (
        <>
            <div className="flex flex-col pt-4 px-4">
                <Link
                href="/quiet-spaces"
                className="absolute top-4 left-4 text-blue-500 hover:text-blue-700"
                >
                &lt; Back to Quiet Spaces
                </Link>
                {successMsg && <p className="mt-8 text-center rounded-md bg-green-50 px-4 py-3 text-green-700">{successMsg}</p>}
            </div>
            <div className="flex flex-col items-center justify-center min-h-screen py-2">
                <form className="w-full max-w-md p-8 space-y-6 bg-white rounded shadow-md" onSubmit={handleSubmit}>
                    <h2 className="text-2xl font-bold text-center">Add a Calm Space</h2>
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>           
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring focus:border-blue-300" required>
                        </input>
                        <label htmlFor="category" className="block text-sm font-medium text-gray-700 mt-4">Category</label>
                        <select
                            id="category"
                            name="category"
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            className="w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring focus:border-blue-300" required>
                            <option value="">Select a category</option>
                            {categoryOptions.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                        <label htmlFor="Address" className="block text-sm font-medium text-gray-700 mt-4">Address</label>
                        <input className="w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring focus:border-blue-300" 
                            type="text" placeholder="Address"
                            value={formData.address}
                            onChange={(e) => setFormData({...formData, address: e.target.value})} required>
                        </input>
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                className="w-1/3 px-3 py-2 mt-4 text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring focus:border-blue-300">
                                Submit
                            </button>
                        </div>
                    </div>
                    </form>
            </div>
        </>
    )
}