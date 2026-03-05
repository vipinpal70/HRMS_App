'use server';

export async function getQuoteOfDay() {
    try {
        const response = await fetch('https://zenquotes.io/api/today', {
            next: { revalidate: 3600 }, // Cache for 1 hour
        });
        const data = await response.json();
        if (data && data.length > 0) {
            return data[0];
        }
        return null;
    } catch (error) {
        console.error('Error fetching quote from server:', error);
        return null;
    }
}
