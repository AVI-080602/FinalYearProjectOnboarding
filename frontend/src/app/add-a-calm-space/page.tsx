'use client';

import { useState } from "react";
import { categoryOptions } from "@/lib/quiet-space-category";

export default function Page() {

    const [formData, setFormData] = useState({
        name: "",
        category: "",
        Address: "",
    });

    const [successMsg, setSuccessMsg] = useState("");

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        
        setSuccessMsg("Calm space added successfully!");
    }

    return (
        <>
            {successMsg && <p className="mt-4 text-center rounded-md bg-green-50 px-4 py-3 text-green-700">{successMsg}</p>}
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
                            value={formData.Address}
                            onChange={(e) => setFormData({...formData, Address: e.target.value})} required>
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