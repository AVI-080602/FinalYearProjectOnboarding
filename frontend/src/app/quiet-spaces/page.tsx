"use client";

import { useEffect, useMemo, useState } from "react";
import CategoryChip from "@/components/category-chip";

type QuietSpace = {
    id: number;
    name: string;
    category: string;
    latitude: number;
    longitude: number;
    wheelchair: string | null;
    sourceDataset: string;
};

export default function Page() {
    const categoryOptions = [
        "All",
        "Art Gallery/Museum",
        "Church",
        "Drinking Fountain",
        "Informal Outdoor Facility (Park/Garden/Reserve)",
        "Library",
        "Picnic Setting",
        "Public Toilet",
        "Seat",
        "Synagogue",
    ];

    const [selectedCategory, setSelectedCategory] = useState<string[]>([]);
    const [quietSpaces, setQuietSpaces] = useState<QuietSpace[]>([]);
    const visibleQuietSpaces = quietSpaces.slice(0, 20);

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

    return (
        <div>
            <h1>Quite Spaces</h1>
            <div>
                <CategoryChip category="Art Gallery/Museum" isSelected={selectedCategory.includes("Art Gallery/Museum")} onClick={() => toggleCategory("Art Gallery/Museum")} />
                <CategoryChip category="Church" isSelected={selectedCategory.includes("Church")} onClick={() => toggleCategory("Church")} />
                <CategoryChip category="Drinking Fountain" isSelected={selectedCategory.includes("Drinking Fountain")} onClick={() => toggleCategory("Drinking Fountain")} />
                <CategoryChip category="Informal Outdoor Facility (Park/Garden/Reserve)" isSelected={selectedCategory.includes("Informal Outdoor Facility (Park/Garden/Reserve)")} onClick={() => toggleCategory("Informal Outdoor Facility (Park/Garden/Reserve)")} />
                <CategoryChip category="Library" isSelected={selectedCategory.includes("Library")} onClick={() => toggleCategory("Library")} />
                <CategoryChip category="Picnic Setting" isSelected={selectedCategory.includes("Picnic Setting")} onClick={() => toggleCategory("Picnic Setting")} />
                <CategoryChip category="Public Toilet" isSelected={selectedCategory.includes("Public Toilet")} onClick={() => toggleCategory("Public Toilet")} />
                <CategoryChip category="Seat" isSelected={selectedCategory.includes("Seat")} onClick={() => toggleCategory("Seat")} />
                <CategoryChip category="Synagogue" isSelected={selectedCategory.includes("Synagogue")} onClick={() => toggleCategory("Synagogue")} />
            </div>
            <div>
            </div>
            <ul>
                {filteredQuietSpaces.map((space) => (
                    <li key={space.id}>{space.name}</li>
                ))}
            </ul>
        </div>

    );
}

