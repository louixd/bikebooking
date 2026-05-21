import { test, expect } from '@playwright/test';

test.describe('Test admin rapide', () => {
  test('ajouter puis supprimer un vélo en compte admin simulé', async ({ page }) => {
    await page.route('**/src/api/entraAuth.js*', async (route) => {
      await route.fulfill({
        contentType: 'application/javascript',
        body: `
          export async function initializeEntraSession() { return 'fast-admin-token'; }
          export async function signInWithEntra() { return null; }
          export async function signOutWithEntra() { return null; }
        `,
      });
    });

    await page.route('**/src/api/bikeflowApi.js*', async (route) => {
      await route.fulfill({
        contentType: 'application/javascript',
        body: `
          let nextBikeId = 10;
          let bikes = [
            { bike_id: 1, bike_name: 'Vélo admin rapide témoin', bike_code: 'FAST-001', bike_description: 'cadre en trapèze', bike_size: 'M', is_available: true },
          ];
          const users = [{ user_id: 1, user_name: 'Admin Rapide' }];

          export function setAuthToken() {}
          export async function loginEntra() {
            return { user_id: 1, user_name: 'Admin Rapide', user_email: 'admin.rapide@example.test', role_name: 'Administrateur', is_admin: true };
          }
          export async function fetchBikes() { return bikes; }
          export async function fetchUsers() { return users; }
          export async function fetchReservations() { return []; }
          export async function fetchReturns() { return []; }
          export async function fetchReparations() { return []; }
          export async function fetchMyStats() { return { total_reservations: 0, total_km: 0, returned_reservations: 0, unique_bikes: 0, favorite_bike: null, active_reservations: 0 }; }
          export async function fetchReservation() { return null; }
          export async function createReservation(data) { return data; }
          export async function cancelReservation() { return {}; }
          export async function createReparation() { return {}; }
          export async function closeReparation() { return {}; }
          export async function createBike(data) {
            const bike = { bike_id: nextBikeId++, bike_name: data.bike_name, bike_code: data.bike_code, bike_size: data.bike_size, bike_description: data.bike_description, is_available: true };
            bikes = [...bikes, bike];
            return bike;
          }
          export async function updateBike(id, data) {
            bikes = bikes.map((bike) => bike.bike_id === Number(id) ? { ...bike, ...data } : bike);
            return bikes.find((bike) => bike.bike_id === Number(id));
          }
          export async function deleteBike(id) {
            bikes = bikes.filter((bike) => bike.bike_id !== Number(id));
            return {};
          }
          export async function fetchReturn() { return null; }
          export async function createReturn() { return {}; }
          export async function createReturnWithPhotos() { return {}; }
        `,
      });
    });

    const bikeName = `Vélo rapide ${Date.now()}`;
    const bikeCode = `FAST-${Date.now()}`;

    await page.goto('/');
    await expect(page.getByText('Admin Rapide - Administrateur')).toBeVisible();

    const addSection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Ajouter un vélo' }) });
    await addSection.getByPlaceholder('Nom du vélo *').fill(bikeName);
    await addSection.getByPlaceholder('Code de base (ex: VL-042) *').fill(bikeCode);
    await addSection.getByPlaceholder('Quantité *').fill('1');
    await addSection.getByRole('combobox').selectOption('M');
    await addSection.getByPlaceholder('Description (facultative)').fill('test rapide');
    await addSection.getByRole('button', { name: 'Ajouter le vélo' }).click();

    const row = page.locator('tr').filter({ hasText: bikeCode });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Supprimer' }).click();
    await row.getByRole('button', { name: 'Confirmer' }).click();
    await expect(page.locator('tr').filter({ hasText: bikeCode })).toHaveCount(0);
  });
});
