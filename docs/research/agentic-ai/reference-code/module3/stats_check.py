from math import comb, sqrt
def wilson(k, n, z=1.96):
    p = k / n
    d = 1 + z*z/n
    c = (p + z*z/(2*n)) / d
    h = z * sqrt(p*(1-p)/n + z*z/(4*n*n)) / d
    return c - h, c + h
def fisher_two_sided(a, b, c, d):
    # 2x2 table [[a,b],[c,d]] ; hypergeometric exact, two-sided by summing probs <= observed
    n1, n2, k = a+b, c+d, a+c
    N = n1+n2
    def pmf(x): return comb(n1, x)*comb(n2, k-x)/comb(N, k)
    obs = pmf(a)
    lo, hi = max(0, k-n2), min(n1, k)
    return sum(pmf(x) for x in range(lo, hi+1) if pmf(x) <= obs + 1e-12)
def mcnemar_exact(b, c):
    n = b + c
    k = min(b, c)
    p = sum(comb(n, i) for i in range(0, k+1)) / 2**n
    return min(1.0, 2*p)
for name, (k, n) in {"v1 14/20": (14, 20), "v2 17/20": (17, 20), "v2 19/20": (19, 20)}.items():
    lo, hi = wilson(k, n); print(name, f"{k/n:.0%}", f"Wilson 95% {lo:.2f}-{hi:.2f}")
print("Fisher 14/20 vs 17/20 p=", round(fisher_two_sided(14, 6, 17, 3), 3))
print("Fisher 14/20 vs 19/20 p=", round(fisher_two_sided(14, 6, 19, 1), 3))
# paired: same 20 cases. v1 passes 14, v2 passes 17. Discordant: v2 fixes 4, breaks 1 -> 14-1+4 = 17
print("McNemar exact b=1 c=4 p=", round(mcnemar_exact(1, 4), 3))
print("McNemar exact b=0 c=6 p=", round(mcnemar_exact(0, 6), 3))
print("Wilson 0/20", [round(x, 2) for x in wilson(0, 20)], " 20/20", [round(x, 2) for x in wilson(20, 20)])
# sample size to tell 70% from 85% - rough normal approx, two proportions, 80% power, alpha .05
p1, p2 = .70, .85
za, zb = 1.96, 0.8416
n = ((za*sqrt(2*((p1+p2)/2)*(1-(p1+p2)/2)) + zb*sqrt(p1*(1-p1)+p2*(1-p2)))**2)/((p2-p1)**2)
print("approx cases per version to detect 70 vs 85%:", round(n))
