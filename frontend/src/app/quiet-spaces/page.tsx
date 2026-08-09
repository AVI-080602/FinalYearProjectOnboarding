"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import CategoryChip from "@/components/category-chip";
import { categoryOptions } from "@/lib/quiet-space-category";
import type { QuietSpace } from "@/types/quiet-space";

const QuietSpaceMap = dynamic(() => import("@/components/quiet-space-map"), {
    ssr: false,
});

export default function Page() {

    const [selectedCategory, setSelectedCategory] = useState<string[]>([]);
    const [quietSpaces, setQuietSpaces] = useState<QuietSpace[]>([]);

    useEffect(() => {
    async function loadQuietSpaces() {
        try {
        const response = await fetch("/data/quiet-spaces.json");

        if (!response.ok) {
            throw new Error("Failed to fetch quiet spaces");
        }

        const data: QuietSpace[] = await response.json();
        setQuietSpaces(data);
        } catch (error) {
        console.error("Error fetching quiet spaces:", error);
        }
    }

    loadQuietSpaces();
    }, []);

    function toggleCategory(category: string) {
        setSelectedCategory((prevSelected) => {
            if (prevSelected.includes(category)) {
                return prevSelected.filter((c) => c !== category);
            } else {
                return [...prevSelected, category];
            }
        });
    }

    const filteredQuietSpaces = useMemo(() => quietSpaces.filter((space) => {
        if (selectedCategory.length === 0) {
            return true;
        }

        return selectedCategory.includes(space.category);
    }), [quietSpaces, selectedCategory]);

    const visibleListSpaces = filteredQuietSpaces.slice(0, 50);

    return (
        <div>
            <h1>Quiet Spaces</h1>
            <div>
                {categoryOptions.map((category) => (
                    <CategoryChip
                        key={category}
                        category={category}
                        isSelected={selectedCategory.includes(category)}
                        onClick={() => toggleCategory(category)}
                    />
                ))}
            </div>
            <p>
                Showing first {visibleListSpaces.length} of {filteredQuietSpaces.length} calm places in the list.
                The map shows the first {Math.min(filteredQuietSpaces.length, 300)} matching places.
            </p>
            {/* quiet-spaces.json is exported from the backend SQLite Refuge table. */}
            <QuietSpaceMap spaces={filteredQuietSpaces} />
            <p className="text-sm text-zinc-600">
                Data: City of Melbourne Open Data (CC BY 4.0).
            </p>
            <ul>
                {visibleListSpaces.map((space) => (
                    <li key={space.id}>{space.name}</li>
                ))}
            </ul>
        </div>

    );
}
