-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "attendeeCount" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "reservations"
  ADD CONSTRAINT "reservation_attendee_count_positive"
  CHECK ("attendeeCount" >= 1);

CREATE FUNCTION enforce_reservation_attendee_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  resource_capacity INTEGER;
BEGIN
  SELECT "capacity"
    INTO resource_capacity
    FROM "resources"
    WHERE "id" = NEW."resourceId"
    FOR UPDATE;

  IF resource_capacity IS NOT NULL AND NEW."attendeeCount" > resource_capacity THEN
    RAISE EXCEPTION 'Reservation has % attendees but resource capacity is %',
      NEW."attendeeCount", resource_capacity
      USING ERRCODE = '23514', CONSTRAINT = 'reservation_attendee_capacity';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "reservations_attendee_capacity_guard"
  BEFORE INSERT OR UPDATE OF "resourceId", "attendeeCount"
  ON "reservations"
  FOR EACH ROW
  EXECUTE FUNCTION enforce_reservation_attendee_capacity();

CREATE FUNCTION enforce_resource_reservation_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."capacity" < OLD."capacity" AND EXISTS (
    SELECT 1
      FROM "reservations"
      WHERE "resourceId" = NEW."id"
        AND "status" IN ('PENDING', 'APPROVED')
        AND "endTime" > CURRENT_TIMESTAMP
        AND "attendeeCount" > NEW."capacity"
  ) THEN
    RAISE EXCEPTION 'Resource capacity cannot be reduced below an upcoming reservation attendee count'
      USING ERRCODE = '23514', CONSTRAINT = 'resource_capacity_below_existing_reservations';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "resources_reservation_capacity_guard"
  BEFORE UPDATE OF "capacity"
  ON "resources"
  FOR EACH ROW
  EXECUTE FUNCTION enforce_resource_reservation_capacity();
