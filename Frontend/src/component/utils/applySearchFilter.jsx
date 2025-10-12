export function applySearchAndFilter(data, search, searchKeys = [], filter, filterKey) {
    return data.filter((item) => {
        const matchesSearch = searchKeys.some((key) =>
            item[key]?.toString().toLowerCase().includes(search.toLowerCase())
        );
        const matchesFilter = filter ? item[filterKey] === filter : true;
        return matchesSearch && matchesFilter;
    });
}
