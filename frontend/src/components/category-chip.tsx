type CategoryChipProps = {
    category: string;
    isSelected: boolean;
    onClick: () => void;
};

export default function CategoryChip({ category, isSelected, onClick }: CategoryChipProps) {
    return (
        <button aria-pressed={isSelected} className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${isSelected ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`} onClick={onClick}>
            {category}
        </button>
    );
}