import { test, expect } from '@playwright/test';

test.describe('BikeBooking site', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/src/api/entraAuth.js*', async (route) => {
      await route.fulfill({
        contentType: 'application/javascript',
        body: `
          export async function initializeEntraSession() { return 'playwright-id-token'; }
          export async function signInWithEntra() { return null; }
          export async function signOutWithEntra() { return null; }
        `,
      });
    });

    await page.route('**/src/api/bikeflowApi.js*', async (route) => {
      await route.fulfill({
        contentType: 'application/javascript',
        body: `
          const today = new Date().toISOString().split('T')[0];
          const bikes = [
            {
              bike_id: 1,
              bike_name: 'Vélo test',
              bike_code: 'E2E-BIKE-1',
              bike_description: 'cadre en trapèze',
              bike_size: 'M',
              is_available: true,
            },
          ];
          let reservations = [];

          export function setAuthToken() {}
          export async function loginEntra() {
            return {
              user_id: 1,
              user_name: 'Playwright User',
              user_email: 'playwright@example.test',
              role_name: 'Utilisateur',
              is_admin: false,
            };
          }
          export async function fetchBikes() { return bikes; }
          export async function createBike() { return {}; }
          export async function updateBike() { return {}; }
          export async function deleteBike() { return {}; }
          export async function fetchUsers() { return [{ user_id: 1, user_name: 'Playwright User' }]; }
          export async function fetchReservations() { return reservations; }
          export async function fetchReservation(id) { return reservations.find((item) => item.reservation_id === Number(id)); }
          export async function createReservation(data) {
            const reservation = {
              reservation_id: 1,
              reservation_code: 'E2E-001',
              bike_id: data.bike_id,
              user_id: data.user_id,
              user_name_free: data.user_name_free,
              reservation_date: data.reservation_date || today + 'T09:00:00',
              return_date: data.return_date || today + 'T10:00:00',
            };
            reservations = [reservation];
            return reservation;
          }
          export async function cancelReservation(id) {
            reservations = reservations.filter((item) => item.reservation_id !== Number(id));
            return {};
          }
          export async function fetchMyStats() {
            return { total_reservations: 0, total_km: 0, returned_reservations: 0, unique_bikes: 0, favorite_bike: null, active_reservations: 0 };
          }
          export async function fetchReparations() { return []; }
          export async function createReparation() { return {}; }
          export async function closeReparation() { return {}; }
          export async function fetchReturns() { return []; }
          export async function fetchReturn() { return null; }
          export async function createReturn() { return {}; }
          export async function createReturnWithPhotos() { return {}; }
        `,
      });
    });
  });

  test('loads the local BikeFlow application', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/BikeFlow/);
    await expect(page.getByText('BikeFlow').first()).toBeVisible();
  });

  test('reserves a bike and then cancels the reservation', async ({ page }) => {
    await page.goto('/');
   // Wait for the page to load and make API calls
    await expect(page.getByRole('heading', { name: /Gestion v.los entreprise/i })).toBeVisible();
    await expect(page.getByText('Playwright User - Utilisateur')).toBeVisible();
    await expect(page.getByText('Vélo test')).toBeVisible();

    await page.getByRole('button', { name: 'Réserver' }).click();
 
    await expect(page.getByRole('heading', { name: /Réserver Vélo test/i })).toBeVisible();
    await expect(page.getByText('Disponible').first()).toBeVisible();
    await page.getByLabel('Début').selectOption('09:00');
    await page.getByLabel('Retour').selectOption('10:00');
    await expect(page.getByText(/de 09:00 à 10:00/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Réserver maintenant' })).toBeDisabled();
    await page.getByRole('checkbox', { name: /J'ai lu et j'accepte/i }).check();

    await page.getByRole('button', { name: 'Réserver maintenant' }).click();

    await expect(page.locator('code', { hasText: 'E2E-001' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mes prochaines réservations' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Annuler' })).toBeVisible();
await page.waitForTimeout(5000); 
    await page.getByRole('button', { name: 'Annuler' }).click();

    await expect(page.locator('code', { hasText: 'E2E-001' })).toHaveCount(0);
    await expect(page.getByText('Aucune réservation pour ce créneau.')).toBeVisible();
  });
});
