import {
  ClientOverride,
  normalizeAssignmentValue,
  normalizeDriverAssignmentValue,
} from "./assignmentOverrides";

export interface RouteAssignmentCluster {
  id: string | number;
  driver?: unknown;
  time: string;
  deliveries: string[];
}

export interface RouteAssignmentState<
  TCluster extends RouteAssignmentCluster = RouteAssignmentCluster,
> {
  clusters: TCluster[];
  clientOverrides: ClientOverride[];
}

export interface RouteSlotConflict {
  driver: string;
  time: string;
  existingRouteId: string;
  incomingRouteId: string;
}

export interface RouteAssignmentMutationResult<
  TCluster extends RouteAssignmentCluster = RouteAssignmentCluster,
> extends RouteAssignmentState<TCluster> {
  touchedRouteIds: string[];
}

interface EffectiveRouteSlot {
  routeId: string;
  driver?: string;
  driverKey?: string;
  time?: string;
  consistent: boolean;
  slotPairs: Array<{
    driver: string;
    driverKey: string;
    time: string;
  }>;
}

interface ClientRouteUpdateParams {
  clientId: string;
  oldClusterId?: string;
  newClusterId?: string;
  driverUpdateRequested?: boolean;
  timeUpdateRequested?: boolean;
  driverValue?: string;
  timeValue?: string;
}

const normalizeRouteId = (routeId?: unknown): string | undefined => {
  if (typeof routeId === "number" && Number.isFinite(routeId)) {
    return String(routeId);
  }

  const normalizedRouteId = normalizeAssignmentValue(routeId);
  return normalizedRouteId || undefined;
};

const normalizeRouteIds = (routeIds: Iterable<string | number | null | undefined>): string[] =>
  Array.from(
    new Set(
      Array.from(routeIds)
        .map((routeId) => normalizeRouteId(routeId))
        .filter((routeId): routeId is string => Boolean(routeId))
    )
  );

const compareRouteIds = (left: string, right: string) => {
  const leftNumber = parseInt(left, 10);
  const rightNumber = parseInt(right, 10);

  if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) {
    return leftNumber - rightNumber;
  }

  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
};

const buildOverrideMap = (clientOverrides: ClientOverride[]) => {
  const overrideMap = new Map<string, ClientOverride>();

  clientOverrides.forEach((override) => {
    overrideMap.set(override.clientId, {
      clientId: override.clientId,
      driver: normalizeAssignmentValue(override.driver),
      time: normalizeAssignmentValue(override.time),
    });
  });

  return overrideMap;
};

const collectAffectedClientIds = (
  clusters: RouteAssignmentCluster[],
  routeIds: Iterable<string | number | null | undefined>
): Set<string> => {
  const routeIdSet = new Set(normalizeRouteIds(routeIds));
  const clientIds = new Set<string>();

  clusters.forEach((cluster) => {
    const routeId = normalizeRouteId(cluster.id);
    if (!routeId || !routeIdSet.has(routeId)) {
      return;
    }

    cluster.deliveries?.forEach((clientId) => {
      const normalizedClientId = normalizeAssignmentValue(clientId);
      if (normalizedClientId) {
        clientIds.add(normalizedClientId);
      }
    });
  });

  return clientIds;
};

export const sanitizeClientOverrides = (clientOverrides: ClientOverride[]): ClientOverride[] =>
  clientOverrides.reduce<ClientOverride[]>((sanitizedOverrides, override) => {
    const clientId = normalizeAssignmentValue(override.clientId);
    const driver = normalizeAssignmentValue(override.driver);
    const time = normalizeAssignmentValue(override.time);

    if (!clientId || (!driver && !time)) {
      return sanitizedOverrides;
    }

    const nextOverride: ClientOverride = { clientId };
    if (driver) {
      nextOverride.driver = driver;
    }
    if (time) {
      nextOverride.time = time;
    }

    sanitizedOverrides.push(nextOverride);
    return sanitizedOverrides;
  }, []);

export const deriveEffectiveRouteSlots = (
  clusters: RouteAssignmentCluster[],
  clientOverrides: ClientOverride[]
): EffectiveRouteSlot[] => {
  const overrideMap = buildOverrideMap(clientOverrides);
  const routeSlots = clusters.map<EffectiveRouteSlot | null>((cluster) => {
    const routeId = normalizeRouteId(cluster.id);

    if (!routeId || !Array.isArray(cluster.deliveries) || cluster.deliveries.length === 0) {
      return null;
    }

    const driverKeys = new Set<string>();
    const timeKeys = new Set<string>();
    let routeDriver: string | undefined;
    let routeTime: string | undefined;
    let missingDriver = false;
    let missingTime = false;
    const slotPairsByKey = new Map<
      string,
      {
        driver: string;
        driverKey: string;
        time: string;
      }
    >();

    cluster.deliveries.forEach((clientId) => {
      const override = overrideMap.get(clientId);
      const effectiveDriver =
        normalizeAssignmentValue(override?.driver) ??
        normalizeDriverAssignmentValue(cluster.driver);
      const effectiveTime =
        normalizeAssignmentValue(override?.time) ?? normalizeAssignmentValue(cluster.time);

      if (!effectiveDriver) {
        missingDriver = true;
      } else {
        const canonicalDriver = effectiveDriver.toLowerCase();
        driverKeys.add(canonicalDriver);
        routeDriver ||= effectiveDriver;
      }

      if (!effectiveTime) {
        missingTime = true;
      } else {
        timeKeys.add(effectiveTime);
        routeTime ||= effectiveTime;
      }

      if (effectiveDriver && effectiveTime) {
        const driverKey = effectiveDriver.toLowerCase();
        slotPairsByKey.set(`${driverKey}::${effectiveTime}`, {
          driver: effectiveDriver,
          driverKey,
          time: effectiveTime,
        });
      }
    });

    const consistent =
      !missingDriver &&
      !missingTime &&
      driverKeys.size === 1 &&
      timeKeys.size === 1 &&
      Boolean(routeDriver) &&
      Boolean(routeTime);

    return {
      routeId,
      driver: routeDriver,
      driverKey: routeDriver ? routeDriver.toLowerCase() : undefined,
      time: routeTime,
      consistent,
      slotPairs: Array.from(slotPairsByKey.values()),
    };
  });

  return routeSlots
    .filter((slot): slot is EffectiveRouteSlot => Boolean(slot))
    .sort((left, right) => compareRouteIds(left.routeId, right.routeId));
};

export const findRouteSlotConflict = (
  state: RouteAssignmentState,
  touchedRouteIds: Iterable<string | number | null | undefined>
): RouteSlotConflict | null => {
  const normalizedTouchedRouteIds = normalizeRouteIds(touchedRouteIds).sort(compareRouteIds);
  if (!normalizedTouchedRouteIds.length) {
    return null;
  }

  const effectiveRouteSlots = deriveEffectiveRouteSlots(state.clusters, state.clientOverrides);
  const effectiveRouteSlotsById = new Map(
    effectiveRouteSlots.map((routeSlot) => [routeSlot.routeId, routeSlot])
  );

  for (const touchedRouteId of normalizedTouchedRouteIds) {
    const incomingRoute = effectiveRouteSlotsById.get(touchedRouteId);

    if (!incomingRoute?.slotPairs.length) {
      continue;
    }

    for (const incomingPair of incomingRoute.slotPairs) {
      const conflictingRoute = effectiveRouteSlots.find(
        (routeSlot) =>
          routeSlot.routeId !== incomingRoute.routeId &&
          routeSlot.slotPairs.some(
            (slotPair) =>
              slotPair.driverKey === incomingPair.driverKey && slotPair.time === incomingPair.time
          )
      );

      if (conflictingRoute) {
        return {
          driver: incomingPair.driver,
          time: incomingPair.time,
          existingRouteId: conflictingRoute.routeId,
          incomingRouteId: incomingRoute.routeId,
        };
      }
    }
  }

  return null;
};

export const assignDriverToRoutes = <TCluster extends RouteAssignmentCluster>(
  state: RouteAssignmentState<TCluster>,
  routeIds: Iterable<string | number | null | undefined>,
  driverName: string
): RouteAssignmentMutationResult<TCluster> => {
  const normalizedRouteIds = normalizeRouteIds(routeIds);
  const normalizedDriver = normalizeAssignmentValue(driverName) ?? "";
  const targetRouteIds = new Set(normalizedRouteIds);
  const affectedClientIds = collectAffectedClientIds(state.clusters, targetRouteIds);

  return {
    clusters: state.clusters.map((cluster) =>
      targetRouteIds.has(normalizeRouteId(cluster.id) || "")
        ? ({
            ...cluster,
            driver: normalizedDriver,
          } as TCluster)
        : cluster
    ),
    clientOverrides: sanitizeClientOverrides(
      state.clientOverrides.map((override) =>
        affectedClientIds.has(override.clientId) ? { ...override, driver: undefined } : override
      )
    ),
    touchedRouteIds: normalizedRouteIds,
  };
};

export const assignTimeToRoutes = <TCluster extends RouteAssignmentCluster>(
  state: RouteAssignmentState<TCluster>,
  routeIds: Iterable<string | number | null | undefined>,
  time: string
): RouteAssignmentMutationResult<TCluster> => {
  const normalizedRouteIds = normalizeRouteIds(routeIds);
  const normalizedTime = normalizeAssignmentValue(time) ?? "";
  const targetRouteIds = new Set(normalizedRouteIds);
  const affectedClientIds = collectAffectedClientIds(state.clusters, targetRouteIds);

  return {
    clusters: state.clusters.map((cluster) =>
      targetRouteIds.has(normalizeRouteId(cluster.id) || "")
        ? ({
            ...cluster,
            time: normalizedTime,
          } as TCluster)
        : cluster
    ),
    clientOverrides: sanitizeClientOverrides(
      state.clientOverrides.map((override) =>
        affectedClientIds.has(override.clientId) ? { ...override, time: undefined } : override
      )
    ),
    touchedRouteIds: normalizedRouteIds,
  };
};

export const moveClientToCluster = <TCluster extends RouteAssignmentCluster>(
  state: RouteAssignmentState<TCluster>,
  clientId: string,
  oldClusterId?: string,
  newClusterId?: string
): RouteAssignmentMutationResult<TCluster> => {
  const normalizedClientId = normalizeAssignmentValue(clientId);
  const normalizedOldClusterId = normalizeRouteId(oldClusterId);
  const normalizedNewClusterId = normalizeRouteId(newClusterId);

  if (!normalizedClientId) {
    return {
      clusters: state.clusters,
      clientOverrides: sanitizeClientOverrides(state.clientOverrides),
      touchedRouteIds: [],
    };
  }

  let updatedClusters = [...state.clusters];

  if (normalizedOldClusterId) {
    updatedClusters = updatedClusters.map((cluster) =>
      normalizeRouteId(cluster.id) === normalizedOldClusterId
        ? ({
            ...cluster,
            deliveries:
              cluster.deliveries?.filter((deliveryId) => deliveryId !== normalizedClientId) ?? [],
          } as TCluster)
        : cluster
    );
  }

  if (normalizedNewClusterId) {
    const targetClusterExists = updatedClusters.some(
      (cluster) => normalizeRouteId(cluster.id) === normalizedNewClusterId
    );

    if (targetClusterExists) {
      updatedClusters = updatedClusters.map((cluster) => {
        if (normalizeRouteId(cluster.id) !== normalizedNewClusterId) {
          return cluster;
        }

        if (cluster.deliveries?.includes(normalizedClientId)) {
          return cluster;
        }

        return {
          ...cluster,
          deliveries: [...(cluster.deliveries ?? []), normalizedClientId],
        } as TCluster;
      });
    } else {
      updatedClusters = [
        ...updatedClusters,
        {
          id: normalizedNewClusterId,
          deliveries: [normalizedClientId],
          driver: "",
          time: "",
        } as TCluster,
      ];
    }
  }

  return {
    clusters: updatedClusters,
    clientOverrides: sanitizeClientOverrides(
      state.clientOverrides.filter((override) => override.clientId !== normalizedClientId)
    ),
    touchedRouteIds: normalizeRouteIds([
      normalizedOldClusterId || "",
      normalizedNewClusterId || "",
    ]),
  };
};

export const updateClientRouteAssignment = <TCluster extends RouteAssignmentCluster>(
  state: RouteAssignmentState<TCluster>,
  params: ClientRouteUpdateParams
): RouteAssignmentMutationResult<TCluster> => {
  const normalizedOldClusterId = normalizeRouteId(params.oldClusterId);
  const normalizedNewClusterId = normalizeRouteId(params.newClusterId);
  const clusterChanged = normalizedOldClusterId !== normalizedNewClusterId;

  let nextState: RouteAssignmentMutationResult<TCluster> = clusterChanged
    ? moveClientToCluster(state, params.clientId, normalizedOldClusterId, normalizedNewClusterId)
    : {
        clusters: [...state.clusters],
        clientOverrides: sanitizeClientOverrides(state.clientOverrides),
        touchedRouteIds: normalizeRouteIds([normalizedNewClusterId || ""]),
      };

  if (!normalizedNewClusterId || (!params.driverUpdateRequested && !params.timeUpdateRequested)) {
    return nextState;
  }

  nextState = {
    ...nextState,
    clusters: nextState.clusters.map((cluster) => {
      if (normalizeRouteId(cluster.id) !== normalizedNewClusterId) {
        return cluster;
      }

      return {
        ...cluster,
        driver: params.driverUpdateRequested
          ? (normalizeAssignmentValue(params.driverValue) ?? "")
          : cluster.driver,
        time: params.timeUpdateRequested
          ? (normalizeAssignmentValue(params.timeValue) ?? "")
          : cluster.time,
      } as TCluster;
    }),
  };

  const targetClientIds = collectAffectedClientIds(nextState.clusters, [normalizedNewClusterId]);

  return {
    ...nextState,
    clientOverrides: sanitizeClientOverrides(
      nextState.clientOverrides.map((override) => {
        if (!targetClientIds.has(override.clientId)) {
          return override;
        }

        return {
          ...override,
          driver: params.driverUpdateRequested ? undefined : override.driver,
          time: params.timeUpdateRequested ? undefined : override.time,
        };
      })
    ),
    touchedRouteIds: normalizeRouteIds([...nextState.touchedRouteIds, normalizedNewClusterId]),
  };
};
