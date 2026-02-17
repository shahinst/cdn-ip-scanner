"""
CDN IP Scanner V2.0 - AI Optimizer
Author: shahinst
"""

import math
import random
import ipaddress


class AIOptimizer:
    def __init__(self):
        self.successful_patterns = {
            'cloudflare': ['104.16.0.0/13', '104.24.0.0/14', '162.159.0.0/19', '172.64.0.0/13'],
            'fastly': ['151.101.0.0/16', '199.232.0.0/16']
        }
        self.priority_ports = [443, 80, 8443, 2053, 2083, 2087, 2096]

    def predict_best_ranges(self, all_ranges, limit=100):
        scored = [(r, self._score(r)) for r in all_ranges]
        scored.sort(key=lambda x: x[1], reverse=True)
        return [r[0] for r in scored[:limit]]

    def _score(self, cidr):
        score = random.uniform(5, 15)
        try:
            net = ipaddress.IPv4Network(cidr, strict=False)
            score += 5.0 / math.log10(max(net.num_addresses, 10))
        except Exception:
            pass
        return score

    def smart_sample(self, cidr, max_ips=50):
        try:
            net = ipaddress.IPv4Network(cidr, strict=False)
            hosts = list(net.hosts())
            if len(hosts) <= max_ips:
                return hosts
            selected = [hosts[0], hosts[-1], hosts[len(hosts) // 2]]
            step = len(hosts) // (max_ips - 10)
            for i in range(0, len(hosts), max(step, 1)):
                if len(selected) >= max_ips - 7:
                    break
                selected.append(hosts[i])
            remaining = max_ips - len(selected)
            if remaining > 0:
                selected.extend(random.sample(hosts, min(remaining, len(hosts))))
            return list(set(selected))[:max_ips]
        except Exception:
            return []
