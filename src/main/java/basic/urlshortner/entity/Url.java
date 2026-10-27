package basic.urlshortner.entity;


import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name="urls",
indexes = {
        @Index(name = "idx_urls_short_url", columnList = "short_url", unique = true)
}
)
@Data
@AllArgsConstructor
@NoArgsConstructor
public class Url {


    @Id
    @GeneratedValue(strategy=GenerationType.UUID)
    private UUID id;

    @Column(nullable=false,length = 2048)
    private String originalUrl;

    @Column(nullable=false, unique=true)
    private String shortUrl;

    @CreationTimestamp
    @Column(nullable=false, updatable=false)
    private LocalDateTime createdAt;

}
