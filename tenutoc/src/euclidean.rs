pub fn euclidean(k: u32, n: u32) -> Vec<bool> {
    if k == 0 {
        return vec![false; n as usize];
    }
    if k >= n {
        return vec![true; n as usize];
    }

    let mut pattern = Vec::with_capacity(n as usize);
    let mut bucket = n - k;

    for _ in 0..n {
        bucket += k;
        if bucket >= n {
            bucket -= n;
            pattern.push(true);
        } else {
            pattern.push(false);
        }
    }

    pattern
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_euclidean_3_8() {
        let pattern = euclidean(3, 8);
        // Expected: [true, false, false, true, false, false, true, false]
        // Based on Bjorklund's algorithm, (3,8) is often represented as [1, 0, 0, 1, 0, 0, 1, 0]
        assert_eq!(pattern, vec![true, false, false, true, false, false, true, false]);
    }

    #[test]
    fn test_euclidean_4_16() {
        let pattern = euclidean(4, 16);
        // Expected: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false]
        assert_eq!(pattern, vec![
            true, false, false, false,
            true, false, false, false,
            true, false, false, false,
            true, false, false, false
        ]);
    }

    #[test]
    fn test_euclidean_edge_cases() {
        assert_eq!(euclidean(0, 4), vec![false, false, false, false]);
        assert_eq!(euclidean(4, 4), vec![true, true, true, true]);
        assert_eq!(euclidean(5, 4), vec![true, true, true, true]); // k > n
    }
}
