import { pool } from '@/lib/db';
import { getCurrentUser, json } from '@/lib/auth';
import { getProfileData } from '@/lib/profile-data';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Authentication required.' }, 401);

  const [profile, rides] = await Promise.all([
    getProfileData(user.id),
    pool.query(
      `SELECT r.id, r.direction, hub.name AS destination, r.departure_start,
              r.departure_end, r.state, vehicle.name AS vehicle,
              r.expected_total_fare AS total_fare,
              place.name AS campus_pickup_point,
              (r.owner_id = $1) AS is_owner
       FROM riders membership
       JOIN rides r ON r.id = membership.ride_id
       JOIN locations hub ON hub.id = r.hub_id
       JOIN locations place ON place.id = membership.campus_location_id
       JOIN vehicle_types vehicle ON vehicle.id = r.vehicle_type_id
       WHERE membership.user_id = $1
       ORDER BY r.departure_start, r.id`,
      [user.id],
    ),
  ]);

  if (!profile) return json({ error: 'Profile is unavailable.' }, 404);

  return new Response(
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        account: {
          email: profile.email,
          fullName: profile.fullName,
          rollNumber: profile.rollNumber,
        },
        profile,
        rides: rides.rows,
      },
      null,
      2,
    ),
    {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Disposition': 'attachment; filename="campus-ride-pooling-data.json"',
        'Content-Type': 'application/json; charset=utf-8',
      },
    },
  );
}
